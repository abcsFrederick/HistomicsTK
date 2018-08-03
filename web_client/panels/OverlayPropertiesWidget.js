import _ from 'underscore';

import events from 'girder/events';
import Panel from 'girder_plugins/slicer_cli_web/views/Panel';

import ItemModel from 'girder/models/ItemModel';
import HistogramModel from 'girder_plugins/large_image/models/HistogramModel';

import HistogramWidget from '../dialogs/histogramWidget';

import overlayPropertiesWidget from '../templates/panels/overlayPropertiesWidget.pug';
import '../stylesheets/panels/overlayPropertiesWidget.styl';

var OverlayPropertiesWidget = Panel.extend({
    events: _.extend(Panel.prototype.events, {
        'input #h-overlay-label': function(e) {
            if (this._histogramView.model.get('loading')) {
                $(e.target).prop('checked', !$(e.target).prop('checked'));
            } else {
                this.overlay.set('label', $(e.target).is(':checked')).save();
            }
        },
        'input #h-overlay-invert-label': function(e) {
            this.overlay.set('invertLabel', $(e.target).is(':checked')).save();
        },
        'input #h-overlay-flatten-label': function(e) {
            this.overlay.set('flattenLabel', $(e.target).is(':checked')).save();
        },
        'input #h-overlay-opacity': function(e) {
            var opacity = this.$('#h-overlay-opacity').val();
            var text = `Overlay opacity ${(opacity * 100).toFixed()}%`;
            this.$('#h-overlay-opacity-label').text(text);
            this.overlay.set('opacity', opacity).save();
        },
        'input #h-overlay-offset-x': function(e) {
            var offset = this.overlay.get('offset');
            this.overlay.set('offset', {x: e.target.valueAsNumber, y: offset.y}).save();
        },
        'input #h-overlay-offset-y': function(e) {
            var offset = this.overlay.get('offset');
            this.overlay.set('offset', {x: offset.x, y: e.target.valueAsNumber}).save();
        },
    }),

    initialize(settings) {
        this.viewer = settings.viewer;
        this.overlay = settings.overlay;
        this.listenTo(this.overlay, 'change:opacity', this._setOverlayOpacity);
        this.listenTo(this.overlay, 'change:threshold change:offset ' +
                                    'change:label change:invertLabel ' +
                                    'change:flattenLabel change:overlayItemId',
                      (overlay, value) => { this.trigger('h:redraw', overlay);});
        this.listenTo(this.overlay, 'change:label',
                      (model, value) => {
                          this._histogramView.model.set('label', value);
                          this._histogramView.getHistogram();
                          this._histogramView.render();
                      });
    },

    render() {
        if (!this.viewer) {
            this.$el.empty();
            return;
        }
        const name = this.overlay.get('name');
        this.$el.html(overlayPropertiesWidget({
            title: 'Properties',
            label: this.overlay.get('label'),
            invertLabel: this.overlay.get('invertLabel'),
            flattenLabel: this.overlay.get('flattenLabel'),
            opacity: this.overlay.get('opacity'),
            offset: this.overlay.get('offset'),
            name
        }));
        this.$('.s-panel-content').collapse({toggle: false});
        this.$('[data-toggle="tooltip"]').tooltip({container: 'body'});
        this._renderHistogram();
        // TODO: move me
        var overlayItem = new ItemModel({
            _id: this.overlay.get('overlayItemId')
        }).fetch().done((overlayItem) => {
            this._histogramView.model.set({
                _id: overlayItem._id,
                fileId: overlayItem.largeImage.originalId,
                loading: true
            });
            this._histogramView.getHistogram();
        });
        return this;
    },

    _renderHistogram() {
        if (this._histogramView) {
            this.stopListening(this._histogramView);
            this._histogramView.off();
            this.$('.h-histogram-widget-container').empty();
        }
        this._histogramView = new HistogramWidget({
            el: this.$('.h-histogram-widget-container'),
            model: new HistogramModel({
                label: this.overlay.get('label')
            }),
            parentView: this,
            threshold: this.overlay.get('threshold')
        }).render();

        this.listenTo(this._histogramView, 'h:range', function (evt) {
            this.overlay.set('threshold', evt.range).save();
        });
    },

    setViewer(viewer) {
        this.viewer = viewer;
        /*
        // make sure our listeners are in the correct order.
        this.stopListening(events, 's:widgetDrawRegion', this._widgetDrawRegion);
        if (viewer) {
            this.listenTo(events, 's:widgetDrawRegion', this._widgetDrawRegion);
            viewer.stopListening(events, 's:widgetDrawRegion', viewer.drawRegion);
            viewer.listenTo(events, 's:widgetDrawRegion', viewer.drawRegion);
        }
         */
        return this;
    },

    _setOverlayOpacity(overlay, value) {
        this.trigger('h:overlayOpacity', {
            index: overlay.get('index'),
            opacity: value
        });
    }
});

export default OverlayPropertiesWidget;
