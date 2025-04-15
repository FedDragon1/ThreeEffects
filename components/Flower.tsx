"use client"

import { FC, useCallback, useEffect, useState } from "react";
import { onCanvasLoad } from "@/lib/flower";

interface FlowerProps {
    className?: string
}

const Flower: FC<FlowerProps> = ({ className }) => {
    const [canvas, setCanvas] = useState<HTMLCanvasElement>()
    const canvasCallback = useCallback((node: HTMLCanvasElement | null) => {
        if (node) {
            setCanvas(node)
        }
    }, [])

    useEffect(() => {
        if (!canvas) {
            return
        }

        console.log("ThreeCanvas Loaded")
        const onUnload = onCanvasLoad(canvas)

        return () => {
            console.log("ThreeCanvas Unmounting...")
            onUnload()
        }
    }, [canvas]);

    return (
        <div className={className}>
            <canvas ref={canvasCallback} className={"w-full h-full"}></canvas>
        </div>
    )
}

export default Flower