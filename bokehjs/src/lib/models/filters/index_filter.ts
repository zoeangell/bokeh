import {Filter} from "./filter"
import type * as p from "core/properties"
import type {Arrayable} from "core/types"
import {PackedIndices} from "core/util/indices"
import type {ColumnarDataSource} from "../sources/columnar_data_source"

export namespace IndexFilter {
  export type Attrs = p.AttrsOf<Props>

  export type Props = Filter.Props & {
    indices: p.Property<Arrayable<number> | null>
  }
}

export interface IndexFilter extends IndexFilter.Attrs {}

export class IndexFilter extends Filter {
  declare properties: IndexFilter.Props

  constructor(attrs?: Partial<IndexFilter.Attrs>) {
    super(attrs)
  }

  static {
    this.define<IndexFilter.Props>(({Int, Arrayable, Nullable}) => ({
      indices: [ Nullable(Arrayable(Int)), null ],
    }))
  }

  compute_indices(source: ColumnarDataSource): PackedIndices {
    const size = source.get_length() ?? 1
    const {indices} = this
    if (indices == null) {
      return PackedIndices.all_set(size)
    } else {
      return PackedIndices.from_indices(size, indices)
    }
  }
}
