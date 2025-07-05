"use client"

import { FC, useCallback, useEffect, useState } from "react";
import { onCanvasLoad } from "@/lib/bamboo";

const Bamboo: FC<Omit<BambooSpec, "rng">> = (props) => {
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
        onCanvasLoad(canvas, props)
    }, [canvas]);

    return (
        <div className={"bg-zinc-200 w-full h-full"}>
            <canvas ref={canvasCallback} className={"w-full h-full"}></canvas>
        </div>
    )
}

export default Bamboo