"use client"

import { FC, useCallback, useEffect, useState } from "react";
import * as THREE from "three"
import { enumerate, walkEdges, walkPoints } from "@/lib/nodes/utils";
import { onCanvasLoad } from "@/lib/bamboo";

interface BambooProps {

}

const Bamboo: FC<BambooProps> = () => {
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
        onCanvasLoad(canvas)
    }, [canvas]);

    return (
        <canvas ref={canvasCallback} className={"w-full aspect-square"}></canvas>
    )
}

export default Bamboo