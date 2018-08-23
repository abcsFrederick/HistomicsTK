import _ from 'underscore';

import eventStream from 'girder/utilities/EventStream';
import View from 'girder/views/View';

import RangeSliderWidget from './rangeSliderWidget';

import histogramWidget from '../templates/dialogs/histogramWidget.pug';
import '../stylesheets/dialogs/histogramWidget.styl';

import ColormapModel from 'girder_plugins/large_image/models/ColormapModel';

var HistogramWidget = View.extend({
    /*
    events: _.extend(View.prototype.events, {
    }),
     */

    initialize: function (settings) {
        this.listenTo(settings.parentView.overlay, 'change:colormapId',
                      (model, value) => {
                          if (value) {
                              this.colormap = new ColormapModel({
                                  _id: value
                              });
                              this.colormap.fetch().done(() => {
                                  this.renderColormap();
                              });
                          } else {
                              this.colormap = undefined;
                              this.renderColormap();
                          }
                      });
        this.listenTo(this.model, 'change', this.render);
        this.threshold = settings.threshold;
        this.listenTo(eventStream,
                      'g:event.large_image.finished_histogram_item',
                      () => { this.model.fetch({ignoreError: true}) });
        if (settings.colormapId) {
            this.colormap = new ColormapModel({
                _id: settings.colormapId
            });
            this.colormap.fetch().done(() => {
                this.renderColormap();
            });
        }
        return View.prototype.initialize.apply(this, arguments);
    },

    renderColormap: function() {
        if (!this.model || !this.colormap || !this.colormap.get('colormap') || !this.model.get('bitmask') && !this.bin_range) {
            this.$('.h-histogram-bar').each((i, bar) => {
                $(bar).css('fill', '');
            });
            return;
        }
        if (!this.model.get('bitmask')) {
            var scale = this.model.get('bins')/(this.bin_range.max - this.bin_range.min);
        }
        var colormapArray = this.colormap.get('colormap');
        this.$('.h-histogram-bar').each((i, bar) => {
            if (i < this.bin_range.min || i > this.bin_range.max) {
                $(bar).css('fill', '');
                return;
            }
            if (this.model.get('bitmask')) {
                //i -= !this.model.get('label');
                //i = i >= 0 ? 1 << i : 0;
                i = Math.round(i*255/8);
            } else {
                i = Math.round(scale*(i - this.bin_range.min));
            }
            if (!colormapArray[i]) {
                return;
            }
            $(bar).css('fill', 'rgb(' + colormapArray[i].join(', ') + ')');
        });
    },

    getHistogram: function () {
        this.model.fetch({ignoreError: true}).fail((error) => {
            this.model.set('loading', true, {silent: true});
            if (error.status == 404) {
                this.model.save().fail((error) => {
                    if (error.status != 409) {
                        this.model.set('loading', false, {silent: true});
                    }
                });
            }
        });
    },

    render: function () {
        var height = this.$('.h-histogram').height();
        var hist = [];
        var valueLabels = [];
        var _hist = this.model.get('hist');
        var binEdges = this.model.get('binEdges');
        if (!height) {
            height = 0;
        }
        if (_hist) {
            var maxValue = Math.max.apply(Math, _hist);
            _hist.forEach(function (value, index) {
                hist.push(height/maxValue*value);
                if (_hist.length == binEdges.length) {
                   valueLabels.push(`${binEdges[index]}`);
                } else {
                   valueLabels.push(`${binEdges[index]}-${binEdges[index + 1]}`);
                }
            });
        }
        this.$el.html(histogramWidget({
            id: 'h-histogram-container',
            loading: this.model.get('loading'),
            hist: hist,
            n: _hist,
            values: valueLabels,
            height: height
        }));

        this.$('.h-histogram-bar').on('click', (e) => {
            $(e.target).toggleClass('selected');
        });

        this.model.set('bins', this.$('.h-histogram').width(), {silent: true});

        if (this._rangeSliderView) {
            this.stopListening(this._rangeSliderView);
            this._rangeSliderView.off();
            this.$('#h-histogram-slider-container').empty();
        }

        if (!this.model.get('loading') && _hist && _hist.length) {
            this._rangeSliderView = new RangeSliderWidget({
                el: this.$('#h-histogram-slider-container'),
                parentView: this,
                binEdges: this.model.get('binEdges'),
                hist: this.model.get('hist'),
                range: this.threshold
            }).render();

            this.bin_range = this._rangeSliderView.bins;
            this.renderColormap();

            this.$('.h-histogram-bar').each((i, bar) => {
                if (bar.id >= this._rangeSliderView.bins.min &&
                    bar.id <= this._rangeSliderView.bins.max) {
                    $(bar).addClass('selected');
                }
            });

            this.listenTo(this._rangeSliderView, 'h:range', function (evt) {
                this.threshold = evt.range;
                this.bin_range = evt.bins;
                this.$('.h-histogram-bar').each((i, bar) => {
                    if (bar.id >= evt.bins.min && bar.id <= evt.bins.max) {
                        $(bar).addClass('selected');
                    } else {
                        $(bar).removeClass('selected');
                     }
                });
                this.renderColormap();
                this.trigger('h:range', evt);
            });

            this.listenTo(this._rangeSliderView, 'h:range', function (evt) {
            });

            this.$('[data-toggle="tooltip"]').tooltip({container: 'body'});
        }

        return this;
    }
});

export default HistogramWidget;
