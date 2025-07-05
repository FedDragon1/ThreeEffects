import Flower from "@/components/Flower";
import React from "react";
import DemoFrame from "@/components/DemoFrame";

export default function Home() {
    return (
        <DemoFrame index={1}>
            <Flower className={"flex-grow max-w-[100vh] anim-show"}></Flower>
        </DemoFrame>
    );
}
