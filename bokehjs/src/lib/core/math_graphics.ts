import {Size} from "./types"
import {BBox} from "./util/bbox"
import {font_metrics, parse_css_font_size, parse_css_length} from "./util/text"
import {isNumber, is_defined, isObject} from "./util/types"
import {Rect} from "./util/affine"
import {color2css, color2hexrgb, color2rgba} from "./util/color"
import * as visuals from "./visuals"
import {default_provider, MathJaxProvider} from "models/text/providers"
import {GraphicsBox} from "./graphics"
import {Context2d} from "./util/canvas"
import {insert_text_on_position} from "./util/string"

export function is_math_box(graphics: unknown): graphics is MathBox {
  return isObject(graphics) && is_defined((graphics as MathBox).provider)
}

export abstract class MathBox extends GraphicsBox {
  font: string
  color: string
  text: string
  valign: number

  constructor({text}: {text: string}) {
    super()
    this.text = text
  }

  get provider(): MathJaxProvider {
    return default_provider
  }

  async load_provider() {
    if (this.provider.status == "not_started")
      await this.provider.fetch()
  }

  _rect(): Rect {
    const {width, height} = this._size()
    const {x, y} = this._computed_position()

    const bbox = new BBox({x, y, width, height})

    return bbox.rect
  }

  set visuals(v: visuals.Text["Values"]) {
    const color = v.color
    const alpha = v.alpha
    const style = v.font_style
    let size = v.font_size
    const face = v.font

    const {font_size_scale, _base_font_size} = this
    const res = parse_css_font_size(size)
    if (res != null) {
      let {value, unit} = res
      value *= font_size_scale
      if (unit == "em" && _base_font_size) {
        value *= _base_font_size
        unit = "px"
      }
      size = `${value}${unit}`
    }

    const font = `${style} ${size} ${face}`
    this.font = font
    this.color = color2css(color, alpha)

    const align = v.align
    this._x_anchor = align

    const baseline = v.baseline
    this._y_anchor = (() => {
      switch (baseline) {
        case "top": return "top"
        case "middle": return "center"
        case "bottom": return "bottom"
        default: return "baseline"
      }
    })()
  }

  protected _computed_position(): {x: number, y: number} {
    const {width, height} = this._size()
    const {sx, sy, x_anchor=this._x_anchor, y_anchor=this._y_anchor} = this.position
    const metrics = font_metrics(this.font)

    const x = sx - (() => {
      if (isNumber(x_anchor))
        return x_anchor*width
      else {
        switch (x_anchor) {
          case "left": return 0
          case "center": return 0.5*width
          case "right": return width
        }
      }
    })()

    const y = sy - (() => {
      if (isNumber(y_anchor))
        return y_anchor*height
      else {
        switch (y_anchor) {
          case "top":
            if (metrics.height > height)
              return (height - (-this.valign - metrics.descent) - metrics.height)
            else
              return 0
          case "center": return 0.5*height
          case "bottom":
            if (metrics.height > height)
              return (
                height + metrics.descent + this.valign
              )
            else return height
          case "baseline": return 0.5*height
        }
      }
    })()

    return {x, y}
  }

  private svg_size(): Size {
    if (!this.provider.MathJax) {
      return {width: 13, height: 13}
    }

    const svg_element = this.to_svg()
    const fmetrics = font_metrics(this.font)

    const heightEx = parseFloat(
      svg_element
        .getAttribute("height")
        ?.replace(/([A-z])/g, "") ?? "0"
    )

    const widthEx = parseFloat(
      svg_element
        .getAttribute("width")
        ?.replace(/([A-z])/g, "") ?? "0"
    )

    const svg_styles = svg_element.getAttribute("style")?.split(";")
    if (svg_styles) {
      const rulesMap = new Map()
      svg_styles.forEach(property => {
        const [rule, value] = property.split(":")
        if (rule) rulesMap.set(rule.trim(), value.trim())
      })
      const v_align = parse_css_length(rulesMap.get("vertical-align"))

      if (v_align?.unit == "ex") {
        this.valign = v_align.value * fmetrics.x_height
      } else if (v_align?.unit == "px") {
        this.valign = v_align.value
      }
    }

    return {
      width: fmetrics.x_height * widthEx,
      height: fmetrics.x_height * heightEx,
    }
  }

  _size(): Size {
    if (!this.provider.MathJax) {
      return {width: 13, height: 13}
    }

    const fmetrics = font_metrics(this.font)
    let {width, height} = this.svg_size()
    height = Math.max(height, fmetrics.height)

    const w_scale = this.width?.unit == "%" ? this.width.value : 1
    const h_scale = this.height?.unit == "%" ? this.height.value : 1

    return {width: width*w_scale, height: height*h_scale}
  }

  paint(ctx: Context2d): void {
    ctx.save()

    const {sx, sy} = this.position
    const {angle} = this
    const {x, y} = this._computed_position()

    if (angle != null && angle != 0) {
      ctx.translate(sx, sy)
      ctx.rotate(angle)
      ctx.translate(-sx, -sy)
    }

    try {
      const mathjax_canvas = new this.provider.MathJax!.MathJaxCanvas(this.to_svg(), ctx, this.svg_size())
      ctx.translate(x, y)
      mathjax_canvas.draw()
    } catch (error) {
      console.error(error)
      ctx.fillStyle = this.color
      ctx.font = this.font
      ctx.textAlign = "left"
      ctx.textBaseline = "alphabetic"
      ctx.fillText(this.text, x, y + font_metrics(this.font).ascent)
    }

    ctx.restore()
  }

  abstract get styled_formula(): string

  abstract to_svg(): SVGSVGElement
}

export class TeXBox extends MathBox {
  get styled_formula(): string {
    const [r, g, b] = color2rgba(this.color)

    return `\\color[RGB]{${r}, ${g}, ${b}} ${this.font.includes("bold") ? `\\bf{${this.text}}` : this.text}`
  }

  to_svg(): SVGSVGElement {
    if (!this.provider.MathJax) {
      throw new Error("Please load MathJax before calling to_svg()")
    }

    // TODO: allow plot/document level configuration of macros
    return this.provider.MathJax.tex2svg(this.styled_formula, {
      em: this.base_font_size,
      ex: font_metrics(this.font).x_height,
    }).children[0] as SVGSVGElement
  }
}

export class MathMLBox extends MathBox {
  get styled_formula(): string {
    let styled = this.text.trim()
    let matchs = styled.match(/<math(.*?[^?])?>/s)
    if (!matchs)
      return this.text.trim()

    styled = insert_text_on_position(
      styled,
      styled.indexOf(matchs[0]) +  matchs[0].length,
      `<mstyle displaystyle="true" mathcolor="${color2hexrgb(this.color)}" ${this.font.includes("bold") ? 'mathvariant="bold"' : "" }>`
    )

    matchs = styled.match(/<\/[^>]*?math.*?>/s)
    if (!matchs)
      return this.text.trim()

    return insert_text_on_position(styled, styled.indexOf(matchs[0]), "</mstyle>")
  }

  to_svg(): SVGSVGElement {
    if (!this.provider.MathJax) {
      throw new Error("Please load MathJax before calling to_svg()")
    }
    const fmetrics = font_metrics(this.font)

    return this.provider.MathJax.mathml2svg(this.styled_formula, {
      em: this.base_font_size,
      ex: fmetrics.x_height,
    }).children[0] as SVGSVGElement
  }
}

export class AsciiBox extends MathBox {
  get styled_formula(): string {
    const [r, g, b] = color2rgba(this.color)
    const ascii = `\\text ${this.text}`

    return `\\color[RGB]{${r}, ${g}, ${b}} ${this.font.includes("bold") ? `\\bf{${ascii}}` : ascii}`
  }

  to_svg(): SVGSVGElement {
    if (!this.provider.MathJax) {
      throw new Error("Please load MathJax before calling to_svg()")
    }

    // TODO: this.provider.MathJax.ascii2svg(this.text)
    return this.provider.MathJax.tex2svg(this.styled_formula, {
      em: this.base_font_size,
      ex: font_metrics(this.font).x_height,
    }).children[0] as SVGSVGElement
  }
}