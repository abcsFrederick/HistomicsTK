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
        this.exclude = settings.exclude || [];
        this.opacities = settings.opacities || [];
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
            this.$('.h-histogram-bar.foreground').each((i, bar) => {
                $(bar).css('fill', '');
            });
            return;
        }
        if (!this.model.get('bitmask')) {
            var scale = this.model.get('bins')/(this.bin_range.max - this.bin_range.min);
        }
        var colormapArray = this.colormap.get('colormap');
        this.$('.h-histogram-bar.foreground').each((i, bar) => {
            var value = parseInt($(bar).attr('value'));
            if (value < this.bin_range.min || value > this.bin_range.max) {
                $(bar).css('fill', '');
                return;
            }
            if (this.model.get('bitmask')) {
                value += this.model.get('label') ? 1 : 0;
                value = Math.round(value*255/8);
            } else {
                value = Math.round(scale*(value - this.bin_range.min));
            }
            if (!colormapArray[value]) {
                return;
            }
            $(bar).css('fill', 'rgb(' + colormapArray[value].join(', ') + ')');
        });
    },

    getHistogram: function () {
        this.model.fetch({ignoreError: true}).fail((error) => {
            this.model.set({
                loading: true,
                error: false,
            }, {silent: true});
            if (error.status == 404) {
                this.model.save().fail((error) => {
                    if (error.status != 409) {
                        this.model.set({loading: false, error: true});
                    }
                });
            }
        });
    },

    render: function () {
        var width = this.$('.h-histogram').width() || 0;
        var height = this.$('.h-histogram').height() || 0;
        var hist = [];
        var valueLabels = [];
        var _hist = this.model.get('hist');
        var binEdges = this.model.get('binEdges');
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
            error: this.model.get('error'),
            hist: hist,
            n: _hist,
            values: valueLabels,
            width_: width,
            height_: height
        }));

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
                var value = parseInt($(bar).attr('value'));
                if (value >= this._rangeSliderView.bins.min &&
                    value <= this._rangeSliderView.bins.max) {
                    $(bar).addClass('selected');
                }
                var bin = value + this.model.get('label');
                if (_.contains(this.exclude, bin)) {
                    $(bar).addClass('exclude');
                } else {
                    var opacity = this.opacities[bin] === undefined ? 1 : this.opacities[bin];
                    $(`.h-histogram-bar.foreground[value=${value}]`).css('opacity', opacity);
                    $(`.h-histogram-bar.opacity[value=${value}]`).attr('y', (1 - opacity)*$(bar).parent()[0].getBBox().height);
                }
            });

            this.$('.h-histogram-bar').contextmenu((e) => {
                var opacity = 1 - e.offsetY/$(e.target).parent()[0].getBBox().height;
                var value = parseInt($(e.target).attr('value'));
                var bin = value + this.model.get('label');
                var opacities = this.opacities.slice();
                opacities[bin] = opacity;
                if (value >= this.bin_range.min && value <= this.bin_range.max &&
                        !_.contains(this.exclude, bin)) {
                    $(`.h-histogram-bar.foreground[value=${value}]`).css('opacity', opacity);
                    $(`.h-histogram-bar.opacity[value=${value}]`).attr('y', e.offsetY);

                    this.trigger('h:opacities', {
                        opacities: opacities,
                        bin: bin,
                        value: opacity
                    });

                    this.opacities = opacities.slice();
                }
                return false;
            });

            this.$('.h-histogram-bar').click((e) => {
                var value = $(e.target).attr('value');
                if (!this.model.get('bitmask') ||
                    value < this.bin_range.min || value > this.bin_range.max) {
                     return;
                }
                var excluded = $(`.h-histogram-bar[value=${value}]`).toggleClass('exclude').hasClass('exclude');
                var bin = parseInt(value) + this.model.get('label');
                var exclude = this.exclude.slice();
                if (excluded) {
                    exclude.push(bin);
                    exclude = _.uniq(exclude);
                    $(`.h-histogram-bar.foreground[value=${value}]`).css('opacity', '');
                } else {
                    exclude = _.without(exclude, bin);
                    $(`.h-histogram-bar.foreground[value=${value}]`).css('opacity', this.opacities[bin]);
                }

                this.trigger('h:exclude', {
                    exclude: exclude,
                    bin: bin,
                    value: excluded
                });

                this.exclude = exclude.slice();
            });

            this.listenTo(this._rangeSliderView, 'h:range', function (evt) {
                this.threshold = evt.range;
                this.bin_range = evt.bins;
                this.$('.h-histogram-bar').each((i, bar) => {
                    var value = parseInt($(bar).attr('value'));
                    if (value >= evt.bins.min && value <= evt.bins.max) {
                        $(bar).addClass('selected');
                    } else {
                        $(bar).removeClass('selected');
                        $(bar).removeClass('exclude');
                    }
                });
                this.renderColormap();
                this.trigger('h:range', evt);
            });

            this.$('[data-toggle="tooltip"]').tooltip({container: 'body'});
        }

        return this;
    }
});

export default HistogramWidget;
