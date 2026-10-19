// macOS 內建 Vision 文字辨識。用法:ocr <image>... → 每張一行 JSON {"path":..., "lines":[...]}
// 編譯:swiftc -O tools/ocr.swift -o tools/.bin/ocr(nightly.sh 會自動做)
import Foundation
import Vision
import AppKit

struct Box {
    let text: String
    let rect: CGRect  // Vision 座標:原點左下、0–1 正規化
}

/// 同一列的字(品名與價格)常被拆成兩個框,先依 Y 分列、列內依 X 排序,再合併成一行
func groupRows(_ boxes: [Box]) -> [String] {
    let sorted = boxes.sorted { $0.rect.midY > $1.rect.midY }
    var rows: [[Box]] = []
    for b in sorted {
        if let last = rows.last, let anchor = last.first {
            let tolerance = max(anchor.rect.height, b.rect.height) * 0.6
            if abs(anchor.rect.midY - b.rect.midY) <= tolerance {
                rows[rows.count - 1].append(b)
                continue
            }
        }
        rows.append([b])
    }
    return rows.map { row in
        row.sorted { $0.rect.minX < $1.rect.minX }.map { $0.text }.joined(separator: " ")
    }
}

func recognize(_ path: String) -> [String] {
    guard let image = NSImage(contentsOfFile: path),
          let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return [] }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["zh-Hant", "en-US"]
    request.usesLanguageCorrection = true
    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    do { try handler.perform([request]) } catch { return [] }
    let boxes = (request.results ?? []).compactMap { obs -> Box? in
        guard let s = obs.topCandidates(1).first?.string else { return nil }
        return Box(text: s, rect: obs.boundingBox)
    }
    return groupRows(boxes)
}

for path in CommandLine.arguments.dropFirst() {
    let obj: [String: Any] = ["path": path, "lines": recognize(path)]
    if let data = try? JSONSerialization.data(withJSONObject: obj, options: []),
       let s = String(data: data, encoding: .utf8) {
        print(s)
    }
}
