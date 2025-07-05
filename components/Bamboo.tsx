"use client"

import { FC, useCallback, useEffect, useState } from "react";
import { onCanvasLoad } from "@/lib/bamboo";
import DemoFrame from "@/components/DemoFrame";

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

        console.log("ThreeCanvas Loaded")
        const onUnload = onCanvasLoad(canvas, props)

        return () => {
            console.log("ThreeCanvas Unmounting...")
            onUnload()
        }
    }, [canvas]);

    return (
        <DemoFrame>
            <div className={"bg-zinc-200 w-full h-full"}>
                <canvas ref={canvasCallback} className={"w-full h-full"}></canvas>
            </div>
        </DemoFrame>
    )
}

export default Bamboo