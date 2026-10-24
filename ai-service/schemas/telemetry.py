"""Telemetry data models for NetSutra network events and Zeek logs."""

from datetime import datetime, timezone
import uuid
from typing import Any, Dict, Optional, Union
from pydantic import BaseModel, Field, field_validator, model_validator


class NetworkEvent(BaseModel):
    """Normalized network connection/event telemetry.
    
    Accepts standard NetSutra fields as well as raw Zeek conn.log fields.
    Does not assume every field exists in every Zeek record.
    """
    event_id: str = Field(
        default_factory=lambda: f"event-{uuid.uuid4().hex[:12]}",
        description="Unique event/connection identifier"
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of the network event (UTC)"
    )
    source_ip: str = Field(..., description="Originating host IP address")
    destination_ip: str = Field(..., description="Responding host IP address")
    source_port: Optional[int] = Field(None, description="Originating transport port")
    destination_port: Optional[int] = Field(None, description="Responding transport port")
    protocol: Optional[str] = Field("tcp", description="Transport layer protocol (tcp, udp, icmp)")
    service: Optional[str] = Field(None, description="Application service (http, ssl, dns, etc.)")
    outbound_bytes: Optional[int] = Field(0, description="Bytes transmitted by originator")
    inbound_bytes: Optional[int] = Field(0, description="Bytes transmitted by responder")
    duration: Optional[float] = Field(0.0, description="Connection duration in seconds")
    conn_state: Optional[str] = Field(None, description="Zeek connection state (e.g., S0, SF, REJ)")
    history: Optional[str] = Field(None, description="Zeek connection history string")
    missed_bytes: Optional[int] = Field(0, description="Missed bytes if any")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional event context")

    @model_validator(mode="before")
    @classmethod
    def normalize_zeek_fields(cls, data: Any) -> Any:
        """Map common Zeek log field names to normalized schema fields."""
        if not isinstance(data, dict):
            return data

        d = dict(data)
        metadata = d.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}

        # 1. Event ID mapping: uid or id
        if "event_id" not in d or not d["event_id"]:
            if "uid" in d and d["uid"]:
                d["event_id"] = str(d["uid"])
            elif "id" in d and isinstance(d["id"], str):
                d["event_id"] = d["id"]

        # 2. Timestamp mapping: ts (epoch seconds float or str)
        if "timestamp" not in d:
            if "ts" in d:
                ts_val = d["ts"]
                if isinstance(ts_val, (int, float)):
                    d["timestamp"] = datetime.fromtimestamp(ts_val, tz=timezone.utc)
                elif isinstance(ts_val, str):
                    try:
                        d["timestamp"] = datetime.fromisoformat(ts_val)
                    except ValueError:
                        try:
                            d["timestamp"] = datetime.fromtimestamp(float(ts_val), tz=timezone.utc)
                        except ValueError:
                            pass

        # 3. Source IP mapping: id.orig_h, orig_h, src_ip, source
        if "source_ip" not in d or not d["source_ip"]:
            for key in ["id.orig_h", "orig_h", "src_ip", "source"]:
                if key in d and d[key]:
                    d["source_ip"] = str(d[key])
                    break

        # 4. Destination IP mapping: id.resp_h, resp_h, dest_ip, destination
        if "destination_ip" not in d or not d["destination_ip"]:
            for key in ["id.resp_h", "resp_h", "dest_ip", "destination"]:
                if key in d and d[key]:
                    d["destination_ip"] = str(d[key])
                    break

        # 5. Source Port mapping: id.orig_p, orig_p, src_port
        if "source_port" not in d or d["source_port"] is None:
            for key in ["id.orig_p", "orig_p", "src_port"]:
                if key in d and d[key] is not None:
                    try:
                        d["source_port"] = int(d[key])
                        break
                    except (ValueError, TypeError):
                        pass

        # 6. Destination Port mapping: id.resp_p, resp_p, dest_port
        if "destination_port" not in d or d["destination_port"] is None:
            for key in ["id.resp_p", "resp_p", "dest_port"]:
                if key in d and d[key] is not None:
                    try:
                        d["destination_port"] = int(d[key])
                        break
                    except (ValueError, TypeError):
                        pass

        # 7. Protocol mapping: proto
        if "protocol" not in d or not d["protocol"]:
            if "proto" in d and d["proto"]:
                d["protocol"] = str(d["proto"]).lower()

        # 8. Outbound bytes mapping: orig_bytes, orig_ip_bytes
        if "outbound_bytes" not in d or d["outbound_bytes"] is None:
            for key in ["orig_bytes", "orig_ip_bytes", "sent_bytes"]:
                if key in d and d[key] is not None:
                    try:
                        d["outbound_bytes"] = int(d[key])
                        break
                    except (ValueError, TypeError):
                        pass

        # 9. Inbound bytes mapping: resp_bytes, resp_ip_bytes
        if "inbound_bytes" not in d or d["inbound_bytes"] is None:
            for key in ["resp_bytes", "resp_ip_bytes", "received_bytes"]:
                if key in d and d[key] is not None:
                    try:
                        d["inbound_bytes"] = int(d[key])
                        break
                    except (ValueError, TypeError):
                        pass

        # 10. Connection state: conn_state
        if "conn_state" not in d or not d["conn_state"]:
            if "state" in d and d["state"]:
                d["conn_state"] = str(d["state"])

        # Retain any extra keys in metadata
        standard_keys = {
            "event_id", "timestamp", "source_ip", "destination_ip",
            "source_port", "destination_port", "protocol", "service",
            "outbound_bytes", "inbound_bytes", "duration", "conn_state",
            "history", "missed_bytes", "metadata"
        }
        for k, v in d.items():
            if k not in standard_keys and k not in metadata:
                metadata[k] = v

        d["metadata"] = metadata
        return d
