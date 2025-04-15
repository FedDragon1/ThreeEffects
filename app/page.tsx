import Flower from "@/components/Flower";

export default function Home() {
    return (
        <div className={"w-screen h-screen relative bg-stone-300"}>
            <Flower className={"w-full h-full fixed top-0 brightness-50 contrast-[5] saturate-[3] hue-rotate-45"}></Flower>
        </div>
    );
}
