#!/usr/bin/env python3
"""生成合成 DICOM 样本素材（CR-002 T-009 / R-007）。

产出：public/samples/dicom/ 下 3 个 series × 6 切片，128×128 8-bit 灰度 phantom：
  phantom-ct-01..06.dcm   （CT，PixelSpacing 1.0mm）
  phantom-mr-01..06.dcm   （MR，PixelSpacing 0.8mm）
  phantom-ct2-01..06.dcm  （CT 薄层重建，PixelSpacing 0.5mm）

要点：
- 全部像素为确定性数学图案（无随机、无时间戳），UID 为固定合成根，
  因此重复运行脚本输出字节级一致（幂等）；
- 去标识化：不含任何真实患者信息；(0012,0062) PatientIdentityRemoved = "YES"、
  (0012,0063) DeidentificationMethod = AGDICOM-SYNTHETIC-PHANTOM；
  PatientName / PatientID 置空；
- 传输语法 Explicit VR Little Endian（无压缩），可被前端 dicom-parser
  与 decodePixel 解码预览（见 src/features/viewer/dicom/）。

用法：
  python -m pip install pydicom   # 首次需要
  python scripts/generate_sample_dicom.py [--out public/samples/dicom]
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

from pydicom import dcmread, dcmwrite
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.uid import (
    CTImageStorage,
    ExplicitVRLittleEndian,
    MRImageStorage,
)

# 固定合成 UID 根（仅本仓库样本使用，非真实设备/机构）
UID_ROOT = "1.2.826.0.1.3680043.10.4242"
STUDY_UID = f"{UID_ROOT}.1"
STUDY_DESCRIPTION = "AGDICOM Synthetic Phantom"
IMPL_CLASS_UID = f"{UID_ROOT}.2"
IMPL_VERSION = "AGDICOM_T009_1.0"

DEID_METHOD = "AGDICOM-SYNTHETIC-PHANTOM"
ROWS = COLUMNS = 128
SLICES_PER_SERIES = 6

# (文件名前缀, Modality, SOPClassUID, SeriesDescription, SeriesNumber, PixelSpacing, SliceThickness)
SERIES_SPECS = [
    ("phantom-ct", "CT", CTImageStorage, "Synthetic CT Phantom Series A", 1, "1.0\\1.0", 1.0),
    ("phantom-mr", "MR", MRImageStorage, "Synthetic MR Phantom Series B", 2, "0.8\\0.8", 1.0),
    ("phantom-ct2", "CT", CTImageStorage, "Synthetic CT Thin-Slice Phantom", 3, "0.5\\0.5", 0.5),
]


def phantom_slice(prefix: str, slice_index: int) -> bytes:
    """确定性 128×128 8-bit phantom：圆形主体 + 环形/内部图案，随切片号变化。"""
    cx = cy = (ROWS - 1) / 2.0
    r_outer = ROWS * 0.45
    pixels = bytearray(ROWS * COLUMNS)
    for y in range(ROWS):
        dy = y - cy
        for x in range(COLUMNS):
            dx = x - cx
            r = math.hypot(dx, dy)
            value = 0
            if r <= r_outer:
                theta = math.atan2(dy, dx)
                value = 40 + int(30 * math.sin(3 * theta + 0.35 * slice_index))
                if r <= r_outer * 0.62:
                    value = 120 + int(60 * math.sin(0.5 * slice_index + r / 12.0))
                if r <= r_outer * 0.25:
                    value = 200 + int((40 * ((x + y + 4 * slice_index) % 24)) / 24)
            pixels[y * COLUMNS + x] = max(0, min(255, value))
    return bytes(pixels)


def build_instance(spec: tuple, slice_index: int) -> Dataset:
    """构造单个切片 Dataset（含 Part-10 文件元信息）。"""
    prefix, modality, sop_class, description, series_number, spacing, thickness = spec
    series_uid = f"{UID_ROOT}.1.{series_number}"
    sop_instance_uid = f"{series_uid}.{slice_index + 1}"

    file_meta = FileMetaDataset()
    file_meta.MediaStorageSOPClassUID = sop_class
    file_meta.MediaStorageSOPInstanceUID = sop_instance_uid
    file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
    file_meta.ImplementationClassUID = IMPL_CLASS_UID
    file_meta.ImplementationVersionName = IMPL_VERSION

    ds = Dataset()
    ds.file_meta = file_meta

    # 病人字段置空 + 去标识化标记（R-007：不得含真实患者信息）
    ds.PatientName = ""
    ds.PatientID = ""
    ds.PatientIdentityRemoved = "YES"  # (0012,0062)
    ds.DeidentificationMethod = DEID_METHOD  # (0012,0063)

    # Study / Series / Instance 标识
    ds.StudyInstanceUID = STUDY_UID
    ds.SeriesInstanceUID = series_uid
    ds.SOPClassUID = sop_class
    ds.SOPInstanceUID = sop_instance_uid
    ds.StudyDescription = STUDY_DESCRIPTION
    ds.SeriesDescription = description
    ds.SeriesNumber = series_number
    ds.InstanceNumber = slice_index + 1
    ds.Modality = modality

    # 图像几何 / 像素编码（无压缩 8-bit 灰度）
    ds.Rows = ROWS
    ds.Columns = COLUMNS
    ds.PixelSpacing = spacing
    ds.SliceThickness = thickness
    ds.ImageOrientationPatient = ["1", "0", "0", "0", "1", "0"]
    ds.ImagePositionPatient = ["0", "0", f"{slice_index * thickness:.2f}"]
    ds.SliceLocation = slice_index * thickness
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.BitsAllocated = 8
    ds.BitsStored = 8
    ds.HighBit = 7
    ds.PixelRepresentation = 0
    ds.RescaleSlope = 1
    ds.RescaleIntercept = 0
    ds.PixelData = phantom_slice(prefix, slice_index)
    return ds


def verify_written(path: Path) -> None:
    """写后校验：能回读且关键标签符合预期（尤其去标识化与像素长度）。"""
    ds = dcmread(path)
    expected = ROWS * COLUMNS
    assert ds.file_meta.TransferSyntaxUID == ExplicitVRLittleEndian, path
    assert ds.Rows == ROWS and ds.Columns == COLUMNS, path
    assert ds.BitsAllocated == 8 and ds.PixelRepresentation == 0, path
    assert len(ds.PixelData) == expected, path
    assert ds.SeriesInstanceUID.startswith(UID_ROOT), path
    assert ds.InstanceNumber >= 1, path
    assert ds.PatientName == "" and ds.PatientID == "", path
    assert ds.PatientIdentityRemoved == "YES", path
    assert ds.DeidentificationMethod == DEID_METHOD, path


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description="生成合成 DICOM phantom 样本")
    parser.add_argument(
        "--out",
        type=Path,
        default=repo_root / "public" / "samples" / "dicom",
        help="输出目录（默认 public/samples/dicom）",
    )
    args = parser.parse_args()
    out_dir: Path = args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    total = 0
    for spec in SERIES_SPECS:
        prefix = spec[0]
        for slice_index in range(SLICES_PER_SERIES):
            path = out_dir / f"{prefix}-{slice_index + 1:02d}.dcm"
            dcmwrite(str(path), build_instance(spec, slice_index), enforce_file_format=True)
            verify_written(path)
            total += 1

    size_kb = sum(f.stat().st_size for f in out_dir.glob("*.dcm")) / 1024
    print(
        f"OK: {total} 个文件 / {len(SERIES_SPECS)} 个 series 已写入 {out_dir}"
        f"（共 {size_kb:.0f} KB）"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
