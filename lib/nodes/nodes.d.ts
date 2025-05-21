type Span<T> = T | T[]

type Unpacked<T> = T extends Iterable<infer U> ? U : never
type ZipResult<Arrays extends readonly Iterable<any>[]> = {
    [I in keyof Arrays]: Unpacked<Arrays[I]>
}
