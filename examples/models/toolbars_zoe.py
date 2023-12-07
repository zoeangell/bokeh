''' This example shows multiple ways to place the toolbar with respect to a grid of plots.

.. bokeh-example-metadata::
    :apis: bokeh.layouts.column, bokeh.layouts.gridplot, bokeh.layouts.row, bokeh.plotting.figure, bokeh.plotting.show
    :refs: :ref:`ug_interaction_tools_toolbar`
    :keywords: tools, toolbar, layout

'''
import numpy as np

from bokeh.layouts import column, gridplot, row
from bokeh.plotting import figure, show
from bokeh.models import HoverTool, BoxEditTool

N = 1000
x = np.random.random(size=N) * 100
y = np.random.random(size=N) * 100
radii = np.random.random(size=N) * 1.5
colors = np.array([(r, g, 150) for r, g in zip(50+2*x, 30+2*y)], dtype="uint8")

TOOLS="hover,crosshair,pan,wheel_zoom,zoom_in,zoom_out,box_zoom,undo,redo,reset,tap,save,box_select,poly_select,lasso_select"

def mkplot(xaxis="below", yaxis="left"):
    TOOLTIPS = [
    ("index", "$index"),
    ("(x,y)", "($x, $y)"),
    ("desc", "@desc"),
]
    p = figure(width=300, height=300, x_axis_location=xaxis, y_axis_location=yaxis)
    hover = HoverTool(tooltips=TOOLTIPS, toggleable=True)
    p.add_tools(hover)
    box_edit = BoxEditTool(visible = True)
    p.add_tools(box_edit)
    p.circle(x, y, radius=radii, fill_color=colors, fill_alpha=0.6, line_color=None)
    return p

def mkgrid(plots, location):
    return gridplot(plots, width=300, height=300, toolbar_location=location)

plot = mkplot()
# l_al = mkgrid([[mkplot(), mkplot()], [mkplot(), mkplot()]], "above")
# l_ar = mkgrid([[mkplot(), mkplot()], [mkplot(), mkplot()]], "below")
# l_bl = mkgrid([[mkplot(), mkplot()], [mkplot(), mkplot()]], "left")
# l_br = mkgrid([[mkplot(), mkplot()], [mkplot(), mkplot()]], "right")

# layout = column(row(l_al, l_ar), row(l_bl, l_br))

show(plot)
