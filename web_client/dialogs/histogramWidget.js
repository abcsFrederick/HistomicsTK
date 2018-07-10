import _ from 'underscore';

import eventStream from 'girder/utilities/EventStream';
import View from 'girder/views/View';

import RangeSliderWidget from './rangeSliderWidget';

import histogramWidget from '../templates/dialogs/histogramWidget.pug';
import '../stylesheets/dialogs/histogramWidget.styl';

var HistogramWidget = View.extend({
    /*
    events: _.extend(View.prototype.events, {
    }),
     */

    initialize: function (settings) {
        this.listenTo(eventStream, 'g:event.large_image.finished_histogram_item', () => {
            this.model.fetch({ignoreError: true});
        });
        this.listenTo(this.model, 'change', this.render);
        this.threshold = settings.threshold;
        return View.prototype.initialize.apply(this, arguments);
    },

    getHistogram: function () {
        this.model.fetch({ignoreError: true}).fail((error) => {
            this.model.set('loading', true, {silent: true});
            if (error.status == 404) {
                this.model.save().fail(() => {
                    this.model.set('loading', false, {silent: true});
                });
            }
        });
    },

    render: function () {
        var height = this.$('.h-histogram').height();
        var hist = [];
        var _hist = this.model.get('hist');
        if (!height) {
            height = 0;
        }
        if (_hist) {
            var maxValue = Math.max.apply(Math, _hist);
            _hist.forEach(function (value, index) {
                hist.push(height/maxValue*value);
            });
        }   
        this.$el.html(histogramWidget({
            id: 'h-histogram-container',
            loading: this.model.get('loading'),
            hist: hist,
            height: height 
        }));

        this.model.set('bins', this.$('.h-histogram').width(), {silent: true});

        if (_hist && _hist.length) {
            if (this._rangeSliderView) {
                this.stopListening(this._rangeSliderView);
                this._rangeSliderView.off();
                this.$('#h-histogram-slider-container').empty();
            }
    
            this._rangeSliderView = new RangeSliderWidget({
                el: this.$('#h-histogram-slider-container'),
                parentView: this,
                binEdges: this.model.get('binEdges'),
                hist: this.model.get('hist'),
                range: this.threshold
            }).render();
    
            this.listenTo(this._rangeSliderView, 'h:range', function (evt) {
                this.threshold = evt.range;
                this.trigger('h:range', evt);           
            });
        }

        return this;
    }
});

export default HistogramWidget;
