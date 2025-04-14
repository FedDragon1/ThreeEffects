import Flower from "@/components/Flower";
import Link from "next/link";

export default function Home() {
    return (
        <div className={"w-screen h-screen relative"}>
            <Flower className={"w-full h-full fixed top-0"}></Flower>
            <Link href={"/test"} className={"z-50 relative"}>Test</Link>
        </div>
    );
}
