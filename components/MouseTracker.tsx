"use client"

import { ReactNode, useEffect, useRef } from "react";

import gsap from "gsap"

interface MouseTrackerProps {
    children: ReactNode
}

function useIsPointerCursor() {
    const isPointerRef = useRef(false);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (!el) return;
            const cursor = getComputedStyle(el).cursor;
            isPointerRef.current = cursor === "pointer";
        };

        window.addEventListener("mousemove", onMove);
        return () => window.removeEventListener("mousemove", onMove);
    }, []);

    return isPointerRef;
}

const MouseTracker = ({ children }: MouseTrackerProps) => {
    const wrapper = useRef<HTMLDivElement>(null)
    const wrapperSize = useRef({ width: 0, height: 0 });
    const prev = useRef({ x: 0, y: 0, t: performance.now() });
    const isPointer = useIsPointerCursor();

    useEffect(() => {
        if (!wrapper.current) {
            return;
        }

        const { width, height } = wrapper.current.getBoundingClientRect();
        wrapperSize.current = { width, height };
    }, [wrapper]);

    useEffect(() => {
        const onMove = (event: MouseEvent) => {
            if (!wrapper.current) {
                return;
            }

            const now = performance.now();
            const x = event.clientX;
            const y = event.clientY;
            const dt = now - prev.current.t || 16; // fallback to ~60fps
            const dx = x - prev.current.x;
            const dy = y - prev.current.y;
            const dist = Math.hypot(dx, dy);

            let scale = 1;
            if (dist > 2) {
                // px per ms → px per second
                const velocity = (dist / dt) * 1000;

                // map velocity to a scale:
                // tweak these min/max to taste
                const minV = 0;
                const maxV = 2000;
                const minScale = 1;
                const maxScale = 1.5;
                // linear interpolation + clamp
                const raw = (velocity - minV) / (maxV - minV);
                scale = Math.min(
                    maxScale,
                    Math.max(minScale, minScale + raw * (maxScale - minScale))
                );
            }

            const h = wrapperSize.current.height * scale
            const w = wrapperSize.current.width * scale;

            // record for next frame
            prev.current = { x, y, t: now };

            const { width, height } = wrapper.current.getBoundingClientRect();

            let borderRadius = "0%";
            if (isPointer.current) {
                borderRadius = "100%";
            }

            gsap.killTweensOf(wrapper.current);
            gsap.to(wrapper.current, {
                duration: 0.5,
                top: y - height / 2,
                left: x - width / 2,
                width: w,
                height: h,
                ease: "power2.out",
                overwrite: false,
            });

            gsap.to(wrapper.current, {
                duration: 1,
                borderRadius,
                ease: "power2.out",
                overwrite: false,
            });

        }

        window.addEventListener("mousemove", onMove)

        return () => {
            window.removeEventListener("mousemove", onMove);
        }
    }, []);

    return (
        <div className={"absolute w-20 h-20 overflow-hidden"} ref={wrapper}>
            {children}
        </div>
    );
}

export default MouseTracker;