"""Regression tests for NetSutra multi-log and batch behavior rules."""
import unittest
from datetime import datetime, timedelta, timezone

from config import Settings
from detection.baseline import BaselineManager
from detection.multilog_rules import MultiLogBehaviorDetector
from schemas.anomaly import DetectionParameters
from schemas.telemetry import NetworkEvent


class MultiLogRulesTests(unittest.TestCase):
    def setUp(self):
        self.detector = MultiLogBehaviorDetector()
        self.baseline = BaselineManager()
        self.params = DetectionParameters()
        self.settings = Settings()
        self.t0 = datetime(2026, 10, 20, 8, 0, tzinfo=timezone.utc)

    def ev(self, i, *, src="192.0.2.10", dst="198.51.100.10", port=443,
           state="SF", out=200, inc=100, meta=None, seconds=None):
        return NetworkEvent(
            event_id=f"test-{i}",
            timestamp=self.t0 + timedelta(seconds=seconds if seconds is not None else i),
            source_ip=src,
            destination_ip=dst,
            destination_port=port,
            source_port=40000 + i,
            protocol="tcp",
            service="ssl",
            outbound_bytes=out,
            inbound_bytes=inc,
            conn_state=state,
            metadata=meta or {},
        )

    def detect(self, events):
        return self.detector.evaluate(events, self.baseline, self.params, self.settings)

    def test_periodic_low_volume_egress_detected_without_fixture_ip(self):
        events = [self.ev(i, src="10.20.1.17", dst="203.0.113.21",
                          seconds=i * 300, out=250, inc=100) for i in range(10)]
        self.assertIn("periodic_egress_pattern", {a.method for a in self.detect(events)})

    def test_connection_fanout_with_failures_detected(self):
        events = [self.ev(i, src="10.20.1.18", dst=f"203.0.113.{i}",
                          state=("REJ" if i % 2 == 0 else "S0"),
                          seconds=i * 2, out=0, inc=0) for i in range(20)]
        self.assertIn("connection_fanout_scan", {a.method for a in self.detect(events)})

    def test_http_sensitive_path_probe_detected(self):
        paths = ["/.env", "/admin", "/api/debug", "/wp-login.php"]
        events = [self.ev(i, meta={"method": "GET", "uri": paths[i % len(paths)],
                                   "status_code": 404, "host": "test.invalid"}) for i in range(8)]
        self.assertIn("http_sensitive_path_probe", {a.method for a in self.detect(events)})

    def test_large_http_post_volume_detected(self):
        events = [self.ev(i, meta={"method": "POST", "uri": "/submit",
                                   "request_body_len": 400000, "status_code": 200}) for i in range(4)]
        self.assertIn("http_large_post_volume", {a.method for a in self.detect(events)})

    def test_dns_nxdomain_burst_detected(self):
        events = [self.ev(i, port=53, meta={"query": f"rand-{i}.invalid",
                                            "qtype_name": "A", "rcode": 3,
                                            "rcode_name": "NXDOMAIN"}) for i in range(12)]
        self.assertIn("dns_nxdomain_burst", {a.method for a in self.detect(events)})

    def test_high_entropy_dns_labels_detected(self):
        queries = [f"{'qwertyuiopasdfghjklzxcvbnm1234567890'[:30]}{i:02d}.subdomain.example.test"
                   for i in range(8)]
        events = [self.ev(i, port=53, meta={"query": q, "qtype_name": "TXT", "qtype": 16, "rcode": 0})
                  for i, q in enumerate(queries)]
        self.assertIn("dns_high_entropy_label_pattern", {a.method for a in self.detect(events)})

    def test_weak_tls_metadata_detected(self):
        events = [self.ev(i, meta={"version": "TLSv10", "cipher": "TLS_RSA_WITH_3DES_EDE_CBC_SHA",
                                   "server_name": None, "validation_status": "unknown"}) for i in range(5)]
        self.assertIn("tls_weak_or_unknown_metadata", {a.method for a in self.detect(events)})

    def test_benign_http_does_not_trigger_http_rules(self):
        events = [self.ev(i, meta={"method": "GET", "uri": "/", "status_code": 200,
                                   "host": "example.test"}) for i in range(8)]
        methods = {a.method for a in self.detect(events)}
        self.assertFalse(methods & {"http_sensitive_path_probe", "http_large_post_volume", "http_error_response_burst"})


if __name__ == "__main__":
    unittest.main()
