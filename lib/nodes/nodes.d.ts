type Span<T> = T | T[]

type Unpacked<T> = T extends Iterable<infer U> ? U : never
type ZipResult<Arrays extends readonly Iterable<any>[]> = {
    [I in keyof Arrays]: Unpacked<Arrays[I]>
}

type ImplRegistry = Record<string, (...args: any) => any>
type FunctionFor<T extends ImplRegistry, M extends keyof T> = T[M]
type ArgsFor<T extends ImplRegistry, M extends keyof T> = Parameters<T[M]>
type ResultFor<T extends ImplRegistry, M extends keyof T> = ReturnType<T[M]>
type ImplDispatcher<T extends ImplRegistry> =
    <M extends keyof T>(method: M, ...args: [...ArgsFor<T, M>]) => ResultFor<T, M>

type Prettify<T> = {
    [K in keyof T]: T[K];
} & {};

type Attributed<T, K> = Prettify<T & K>

interface Clipping {
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number
}

interface Handle {
    x: number,
    y: number,
    type: "cubic" | "linear"
}