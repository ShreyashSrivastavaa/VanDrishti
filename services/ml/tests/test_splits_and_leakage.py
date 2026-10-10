import pytest
from forestwatch_ml.training.build_dataset import generate_geographic_blocks, create_leakage_safe_splits

def test_leakage_safe_splits():
    # 40 km x 40 km region -> ~16 geographic blocks
    bbox = (-63.50, -10.00, -63.14, -9.64)
    blocks = generate_geographic_blocks(bbox, block_size_km=10.0)
    assert len(blocks) >= 16

    splits = create_leakage_safe_splits(
        blocks,
        train_ratio=0.70,
        val_ratio=0.15,
        buffer_km=1.0,
        seed=42
    )

    train_set = set(splits["train"])
    val_set = set(splits["val"])
    test_set = set(splits["test"])

    # Strict spatial mutual exclusivity test
    assert len(train_set.intersection(val_set)) == 0, "Train and Val splits leak shared blocks!"
    assert len(train_set.intersection(test_set)) == 0, "Train and Test splits leak shared blocks!"
    assert len(val_set.intersection(test_set)) == 0, "Val and Test splits leak shared blocks!"

    # Total blocks covered
    total_assigned = len(train_set) + len(val_set) + len(test_set)
    assert total_assigned == len(blocks)
