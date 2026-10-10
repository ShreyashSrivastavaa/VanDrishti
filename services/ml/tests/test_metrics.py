import numpy as np
import pytest
from forestwatch_ml.training.evaluate import compute_metrics

def test_metrics_hand_computed_case():
    # Construct exact confusion matrix:
    # TP: 50, FP: 10, FN: 20, TN: 20
    targets = np.array([1]*50 + [0]*10 + [1]*20 + [0]*20, dtype=np.float32)
    preds = np.array([0.9]*50 + [0.8]*10 + [0.1]*20 + [0.2]*20, dtype=np.float32)

    m = compute_metrics(preds, targets)

    assert m["confusion_matrix"]["true_positive"] == 50
    assert m["confusion_matrix"]["false_positive"] == 10
    assert m["confusion_matrix"]["false_negative"] == 20
    assert m["confusion_matrix"]["true_negative"] == 20

    assert pytest.approx(m["accuracy"], 0.001) == 0.70
    assert pytest.approx(m["precision"], 0.001) == 50 / 60
    assert pytest.approx(m["recall"], 0.001) == 50 / 70
    assert pytest.approx(m["f1_score"], 0.001) == 50 / 65
    assert pytest.approx(m["iou_forest"], 0.001) == 50 / 80
    assert m["expected_calibration_error"] >= 0.0
