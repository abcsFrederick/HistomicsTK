import _ from 'underscore';

import View from 'girder/views/View';

import rangeSliderWidget from '../templates/dialogs/rangeSliderWidget.pug';
import '../stylesheets/dialogs/rangeSliderWidget.styl';

var RangeSliderWidget = View.extend({

    initialize: function (settings) {
        this.binEdges = settings.binEdges;
        this.hist = settings.hist;
        this.range = settings.range;
        return View.prototype.initialize.apply(this, arguments);
    },

    // TODO: maping pixels to hist, bins/increments

    // FIXME: events prototype
    onSliderEnd: function(e) {
        $(this).off('mousemove mouseup mouseleave');

        var view = e.data.view;
        var target = e.data.target;
        var sliderRange = e.data.sliderRange;
        var range = e.data.range;
        var _range = {
            min: range.min,
            max: range.max
        };
        var barWidth = e.data.barWidth;
        var isMinSlider = e.data.isMinSlider;
        var isMaxSlider = e.data.isMaxSlider;

        var offset = $(target).offset().left;
        if (isMinSlider) {
            var n = Math.round((offset - sliderRange.min)/barWidth);
            offset = Math.round(n*barWidth) + sliderRange.min;
            _range.min = n;
        } else if (isMaxSlider) {
            var n = Math.round((sliderRange.max - offset)/barWidth);
            offset = sliderRange.max - Math.round(n*barWidth);
            _range.max = view.hist.length - n - 1;
        }
        $(target).offset({left: offset});

        if (_range.min != range.min || _range.max != range.max) {
            range.min = _range.min;
            range.max = _range.max;
            var maxIndex = range.max;
            if (view.hist.length == view.binEdges.length) {
                maxIndex++
            }
            view.trigger('h:range', {range: {
                min: view.binEdges[range.min],
                max: view.binEdges[range.max]
            }});
        }
    },

    onSliderMove: function(e) {
        var offset = e.pageX + e.data.x;
        offset = Math.max(offset, e.data.sliderRange_.min);
        offset = Math.min(offset, e.data.sliderRange_.max);
        $(e.data.target).offset({left: offset});
    },

    onSliderBegin: function(e) {
        var view = e.data.view;
        var barWidth = e.data.barWidth;

        var prevSibling = $(this).prev('.range-slider');
        var nextSibling = $(this).next('.range-slider');

        var parentOffset = $(this).parent().offset().left;
        var parentWidth = $(this).parent().width();
        var sliderWidth = $(this).parent().height();
        var sliderRange_ = {
            min: prevSibling.length ?  prevSibling.offset().left + sliderWidth + Math.floor(barWidth) : parentOffset - sliderWidth,
            max: nextSibling.length ? nextSibling.offset().left - sliderWidth - Math.floor(barWidth) : parentOffset + parentWidth
        };

        var data = {
            view: view,
            target: this,
            sliderRange: e.data.sliderRange,
            sliderRange_: sliderRange_,
            range: e.data.range,
            x: $(this).offset().left - e.pageX,
            barWidth: barWidth,
            isMinSlider: prevSibling.length ? false : true,
            isMaxSlider: nextSibling.length ? false : true
        };

        $(this).parent().on('mouseup mouseleave', null, data, view.onSliderEnd);

        $(this).parent().on('mousemove', null, data, view.onSliderMove);
    },

    render: function () {
        this.$el.html(rangeSliderWidget());

        var parentOffset = this.$el.offset().left;
        var parentWidth = this.$el.width();
        var sliderWidth = this.$el.height();
        var barWidth = parentWidth/this.binEdges.length;

        var sliderRange = {
            min: parentOffset - sliderWidth,
            max: parentOffset + parentWidth
        };

        var range = {min: 0, max: this.hist.length - 1};
        if (this.range) {
            this.binEdges.forEach((value, index) => {
                if (value == this.range.min) {
                    range.min = index;
                }
                if (value == this.range.max) {
                    range.max = index;
                }
            });
        }

        var sliderOffset = {min: sliderRange.min, max: sliderRange.max};
        sliderOffset.min += range.min * barWidth;
        sliderOffset.max -= (this.hist.length - range.max - 1) * barWidth;
        this.$('.min-range-slider').offset({left: sliderOffset.min});
        this.$('.max-range-slider').offset({left: sliderOffset.max});

        // FIXME: variable scope
        var data = {
            view: this,
            barWidth: barWidth,
            sliderRange: sliderRange,
            range: range
        }

        this.$('.range-slider').on('mousedown', null, data, this.onSliderBegin);

        return this;
    }
});

export default RangeSliderWidget;
