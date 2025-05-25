import { FC } from "react";
import Bamboo from "@/components/Bamboo";

const BambooPage: FC = () => {
    return (
        <div className={"relative w-screen h-screen flex justify-center items-center"}>
            <Bamboo bamboo={{ bend: 2, minHeight: 0.5, maxHeight: 2, windSpeed: 0.1, windScale: 4 }}
                    knot={{ minHeight: 0.2, maxHeight: 0.3}}
                    leaves={{ count: 10, windScale: 0.8, windSpeed: 0.05 }}
                    shader={{ near: 7, far: 10 }}/>
        </div>
    )
}

export default BambooPage