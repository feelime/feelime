#!/usr/bin/env python3
"""Extract diagnostic tombstones and summarize native crash frames offline.
No Android device, protobuf package, or network access required.
"""
import argparse
import base64
import hashlib
import json
import re
from pathlib import Path


def wire_fields(raw):
    """Decode protobuf wire fields without a runtime dependency; bounds checked."""
    pos = 0
    def varint():
        nonlocal pos
        value = 0
        for shift in range(0, 70, 7):
            assert pos < len(raw), 'truncated protobuf varint'
            byte = raw[pos]
            pos += 1
            value |= (byte & 127) << shift
            if byte < 128:
                return value
        raise AssertionError('oversize protobuf varint')
    fields = {}
    while pos < len(raw):
        tag = varint()
        number, kind = tag >> 3, tag & 7
        assert number > 0, 'invalid protobuf field'
        if kind == 0:
            value = varint()
        elif kind in (1, 2, 5):
            length = varint() if kind == 2 else 8 if kind == 1 else 4
            assert pos + length <= len(raw), 'truncated protobuf field'
            value = raw[pos:pos + length]
            pos += length
        else:
            raise AssertionError('unexpected protobuf wire type ' + str(kind))
        fields.setdefault(number, []).append(value)
    return fields


def extract_report(report, output):
    output.mkdir(parents=True, exist_ok=True)
    pattern = r"--- tombstone (tb-\d+-\d+\.bin) bytes=(\d+)([^\n]*) base64 ---\n([A-Za-z0-9+/=\n]+)"
    summaries = []
    for match in re.finditer(pattern, report):
        name, size, metadata, encoded = match.groups()
        raw = base64.b64decode(encoded.replace("\n", ""), validate=True)
        assert len(raw) == int(size), "byte count mismatch: " + name
        digest = hashlib.sha256(raw).hexdigest()
        expected = re.search(r"sha256=([0-9a-f]{64})", metadata)
        assert not expected or expected[1] == digest, "SHA mismatch: " + name
        flag = re.search(r"truncated=(\S+)", metadata)
        summary = {"file": name, "bytes": len(raw), "sha256": digest,
                   "truncated": flag[1] if flag else "unknown"}
        (output / name).write_bytes(raw)
        try:
            fields = wire_fields(raw)
            summary["pid"] = fields.get(5, [None])[0]
            summary["tid"] = fields.get(6, [None])[0]
            summary["signal"] = wire_fields(fields.get(10, [b""])[0]).get(1, [None])[0]
            frames = []
            for entry in fields.get(16, []):
                item = wire_fields(entry)
                thread = wire_fields(item[2][0])
                tid = item.get(1, [0])[0]
                for value in thread.get(4, []):
                    frame = wire_fields(value)
                    frames.append({"tid": tid, "crashed": tid == summary["tid"],
                        "thread": thread.get(2, [b""])[0].decode("utf-8", "replace"),
                        "rel_pc": hex(frame.get(1, [0])[0]),
                        "module": frame.get(6, [b""])[0].decode("utf-8", "replace"),
                        "build_id": frame.get(8, [b""])[0].decode("utf-8", "replace"),
                        "function": frame.get(4, [b""])[0].decode("utf-8", "replace")})
            summary["frames"] = frames
        except (AssertionError, KeyError) as error:
            summary["parse_error"] = str(error) # Raw evidence still retained.
        summaries.append(summary)
    assert summaries, "no tombstone attachment found"
    (output / "summary.json").write_text(json.dumps(summaries, ensure_ascii=False, indent=2))
    return summaries


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    for summary in extract_report(args.report.read_text(), args.output):
        print(summary["file"], "bytes=", summary["bytes"], "pid=", summary.get("pid"),
              "signal=", summary.get("signal"), "truncated=", summary["truncated"],
              "parse_error=", summary.get("parse_error", "none"))
