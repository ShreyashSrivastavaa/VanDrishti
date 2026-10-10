import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, Any
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim

from ..models.unet import ForestUNet
from ..storage.artifact_store import artifact_store

def dice_loss(preds: torch.Tensor, targets: torch.Tensor, smooth: float = 1.0) -> torch.Tensor:
    preds_flat = preds.contiguous().view(-1)
    targets_flat = targets.contiguous().view(-1)
    intersection = (preds_flat * targets_flat).sum()
    dice = (2.0 * intersection + smooth) / (preds_flat.sum() + targets_flat.sum() + smooth)
    return 1.0 - dice

def combined_loss(preds: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
    bce = nn.functional.binary_cross_entropy(preds, targets)
    dice = dice_loss(preds, targets)
    return 0.5 * bce + 0.5 * dice

def train_model(small: bool = True, epochs: int = 3, batch_size: int = 2) -> Dict[str, Any]:
    print(f"[{datetime.utcnow().isoformat()}] Starting ForestWatch U-Net training pipeline (small={small})...")
    torch.manual_seed(42)
    np.random.seed(42)

    device = torch.device("cuda" if torch.cuda.is_available() and not small else "cpu")
    print(f"Using device: {device}")

    model = ForestUNet(in_channels=8, out_channels=1, base_features=16 if small else 32)
    model.to(device)

    optimizer = optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)

    # Generate synthetic training chips (256 x 256) simulating Sentinel-2 8-band stacks
    n_samples = 8 if small else 64
    chips = []
    labels = []

    for _ in range(n_samples):
        # 8 channels: B02, B03, B04, B08, B11, B12, NDVI, NBR
        stack = np.random.uniform(0.02, 0.85, (8, 256, 256)).astype(np.float32)
        # Forest label: binary mask
        lbl = (stack[3] > 0.45).astype(np.float32) # NIR threshold
        chips.append(stack)
        labels.append(lbl[np.newaxis, ...])

    x_tensor = torch.tensor(np.array(chips), dtype=torch.float32)
    y_tensor = torch.tensor(np.array(labels), dtype=torch.float32)

    dataset = torch.utils.data.TensorDataset(x_tensor, y_tensor)
    dataloader = torch.utils.data.DataLoader(dataset, batch_size=batch_size, shuffle=True)

    model.train()
    for epoch in range(1, epochs + 1):
        total_loss = 0.0
        for batch_x, batch_y in dataloader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            optimizer.zero_grad()
            preds = model(batch_x)
            loss = combined_loss(preds, batch_y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        avg_loss = total_loss / len(dataloader)
        print(f"  Epoch [{epoch}/{epochs}] - Loss: {avg_loss:.4f}")

    # Save weights
    out_dir = Path("./data/artifacts/models/unet_resnet34").resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    weights_path = out_dir / "model.pt"
    torch.save(model.state_dict(), weights_path)

    model_card = {
        "name": "unet_resnet34",
        "version": "0.1.0",
        "architecture": "ForestUNet-8ch",
        "status": "prototype",
        "input_bands": ["B02", "B03", "B04", "B08", "B11", "B12", "NDVI", "NBR"],
        "chip_size": [256, 256],
        "training_samples": n_samples,
        "epochs": epochs,
        "final_loss": round(avg_loss, 4),
        "weights_path": str(weights_path),
        "created_at": datetime.utcnow().isoformat(),
        "disclaimer": "Prototype model weights. Pending geographical holdout test evaluation before promotion to 'validated' status."
    }

    card_path = out_dir / "model_card.json"
    with open(card_path, "w") as f:
        json.dump(model_card, f, indent=2)

    print(f"Model weights exported to: {weights_path}")
    print(f"Model card exported to: {card_path}")
    return model_card

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--small", action="store_true", default=True)
    parser.add_argument("--epochs", type=int, default=2)
    args = parser.parse_args()
    train_model(small=args.small, epochs=args.epochs)
