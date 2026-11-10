"use client";

import Barcode from "react-barcode";

interface BarcodeLabelProps {
  value: string;
  height?: number;
  className?: string;
}

export function BarcodeLabel({ value, height = 36, className }: BarcodeLabelProps) {
  return (
    <div
      className={`flex w-full items-center justify-center overflow-hidden [&>svg]:h-auto [&>svg]:w-full ${className ?? ""}`}
    >
      <Barcode
        value={value}
        format="CODE128"
        renderer="svg"
        width={1}
        height={height}
        margin={0}
        displayValue
        fontSize={8}
        background="transparent"
      />
    </div>
  );
}
