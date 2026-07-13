#!/usr/bin/env swift
import Foundation
import Vision
import CoreImage
import CoreImage.CIFilterBuiltins

struct ExtractionError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

func extractForeground(source: URL, destination: URL, context: CIContext) throws {
    guard let input = CIImage(contentsOf: source) else {
        throw ExtractionError(message: "无法读取图片：\(source.path)")
    }

    let handler = VNImageRequestHandler(ciImage: input)
    let request = VNGenerateForegroundInstanceMaskRequest()
    try handler.perform([request])
    guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
        throw ExtractionError(message: "未识别到前景主体：\(source.lastPathComponent)")
    }

    let maskBuffer = try observation.generateScaledMaskForImage(
        forInstances: observation.allInstances,
        from: handler
    )
    let mask = CIImage(cvPixelBuffer: maskBuffer)
    let transparent = CIImage(color: .clear).cropped(to: input.extent)
    let blend = CIFilter.blendWithMask()
    blend.inputImage = input
    blend.backgroundImage = transparent
    blend.maskImage = mask
    guard let output = blend.outputImage?.cropped(to: input.extent) else {
        throw ExtractionError(message: "无法合成透明前景：\(source.lastPathComponent)")
    }
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else {
        throw ExtractionError(message: "无法创建 sRGB 色彩空间")
    }

    try FileManager.default.createDirectory(
        at: destination.deletingLastPathComponent(),
        withIntermediateDirectories: true
    )
    try context.writePNGRepresentation(
        of: output,
        to: destination,
        format: .RGBA8,
        colorSpace: colorSpace
    )
}

let arguments = Array(CommandLine.arguments.dropFirst())
guard !arguments.isEmpty, arguments.count.isMultiple(of: 2) else {
    fputs("用法：swift scripts/extract-foreground.swift <输入.png> <输出.png> [...]\n", stderr)
    exit(64)
}

let context = CIContext()
do {
    for index in stride(from: 0, to: arguments.count, by: 2) {
        let source = URL(fileURLWithPath: arguments[index])
        let destination = URL(fileURLWithPath: arguments[index + 1])
        try extractForeground(source: source, destination: destination, context: context)
        print("已提取前景：\(source.lastPathComponent)")
    }
} catch {
    fputs("透明前景提取失败：\(error.localizedDescription)\n", stderr)
    exit(1)
}
