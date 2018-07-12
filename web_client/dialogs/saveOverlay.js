import _ from 'underscore';

import View from 'girder/views/View';

import HierarchyWidget from 'girder/views/widgets/HierarchyWidget';
import RootSelectorWidget from 'girder/views/widgets/RootSelectorWidget';

import BrowserWidget from 'girder/views/widgets/BrowserWidget';

import HistogramModel from 'girder_plugins/large_image/models/HistogramModel';
import HistogramWidget from './histogramWidget';

import saveOverlay from '../templates/dialogs/saveOverlay.pug';

/**
 * Create a modal dialog with fields to edit the properties of
 * an overlay before POSTing it to the server.
 */
var SaveOverlay = View.extend({
    events: {
        'click .h-cancel': 'cancel',
        'submit form': 'save',
        'input #h-overlay-opacity': function(e) {
            var opacity = this.$('#h-overlay-opacity').val();
            var text = `Overlay opacity ${(opacity * 100).toFixed()}%`;
            this.$('#h-overlay-opacity-label').text(text);
            this.overlay.set('opacity', opacity);
        },
        'input #h-overlay-offset-x': function(e) {
            var offset = this.overlay.get('offset');
            console.log(e);
            this.overlay.set('offset', {x: e.target.valueAsNumber, y: offset.y});
        },
        'input #h-overlay-offset-y': function(e) {
            var offset = this.overlay.get('offset');
            this.overlay.set('offset', {x: offset.x, y: e.target.valueAsNumber});
        },
        'input #h-overlay-label': function(e) {
            this.overlay.set('label', $(e.target).is(':checked'));
        },
        'input #h-overlay-invert-label': function(e) {
            this.overlay.set('invertLabel', $(e.target).is(':checked'));
        },
        'input #h-overlay-flatten-label': function(e) {
            this.overlay.set('flattenLabel', $(e.target).is(':checked'));
        },
    },

    initialize(settings = {}) {
        this.helpText = 'Click on a slide item to open.';
        this.showItems = true;
        this.submitText = 'Open';
        this.root = null;
        this.selectItem = true;
        this.showMetadata = false;
        this._selected = null;

        // generate the root selection view and listen to it's events
        this._rootSelectionView = new RootSelectorWidget(_.extend({
            parentView: this
        }, { pageLimit: 10 }));
        this.listenTo(this._rootSelectionView, 'g:selected', function (evt) {
            this.root = evt.root;
            this._renderHierarchyView();
        });
    },

    show: function(params, options) {
        this.overlay = params.overlay;
        this._overlay = params.overlay ? params.overlay.clone() : params.overlay;
        this.folder = params.folder;
        this.overlayItem = params.overlayItem;
        this.options = options;

        this.setElement('#g-dialog-container').render();
    },

    render() {
        this.root = this.folder;
        this._rootSelectionView.selected = this.folder;
        this.$el.html(
            saveOverlay({
                title: this.options.title,
                name: this.overlay.get('name'),
                description: this.overlay.get('description'),
                label: this.overlay.get('label'),
                invertLabel: this.overlay.get('invertLabel'),
                flattenLabel: this.overlay.get('flattenLabel'),
                opacity: this.overlay.get('opacity'),
                offset: this.overlay.get('offset'),
                help: this.helpText,
                preview: this.showPreview,
                selectItem: this.selectItem,
            })
        ).girderModal(this);
        this._renderHistogram();
        this._renderRootSelection();
        this._resetSelection(this.overlayItem);
        return this;
    },

    cancel(evt) {
        this.overlay.set(this._overlay.attributes);
        evt.preventDefault();
        this.$el.modal('hide');
    },

    save(evt) {
        evt.preventDefault();

        if (!this.$('#h-overlay-name').val()) {
            this.$('#h-overlay-name').parent()
                .addClass('has-error');
            this.$('.g-validation-failed-message')
                .text('Please enter a name.')
                .removeClass('hidden');
            return;
        }

        this._validate();

        this._overlay = this.overlay.clone();
    },

    selectedModel: function () {
        return this._selected;
    },

    _renderHistogram() {
        if (this._histogramView) {
            this.stopListening(this._histogramView);
            this._histogramView.off();
            this.$('.h-histogram-widget-container').empty();
        }
        if (!this.root) {
            return;
        }
        this._histogramView = new HistogramWidget({
            el: this.$('.h-histogram-widget-container'),
            model: new HistogramModel({
                _id: this.overlayItem.id,
                fileId: this.overlayItem.get('largeImage').originalId,
                label: this.overlay.get('label') ? 1 : 0
            }),
            parentView: this,
            threshold: this.overlay.get('threshold')
        }).render();

        this.listenTo(this._histogramView, 'h:range', function (evt) {
            this.overlay.set('threshold', evt.range);
        });
    },

    _renderRootSelection: function () {
        this._rootSelectionView.setElement(this.$('.g-hierarchy-root-container')).render();
        this._renderHierarchyView();
    },

    _renderHierarchyView: function () {
        if (this._hierarchyView) {
            this.stopListening(this._hierarchyView);
            this._hierarchyView.off();
            this.$('.g-hierarchy-widget-container').empty();
        }
        if (!this.root) {
            return;
        }
        this.$('.g-wait-for-root').removeClass('hidden');
        this._hierarchyView = new HierarchyWidget({
            el: this.$('.g-hierarchy-widget-container'),
            parentView: this,
            parentModel: this.root,
            checkboxes: false,
            routing: false,
            showActions: false,
            showItems: this.showItems,
            onItemClick: _.bind(this._selectItem, this),
            showMetadata: this.showMetadata
        });
        this.listenTo(this._hierarchyView, 'g:setCurrentModel', this._selectModel);
        this._selectModel();
    },

    _resetSelection: function (model) {
        this._selected = model;
        this.$('.g-validation-failed-message').addClass('hidden');
        this.$('.g-selected-model').removeClass('has-error');
        this.$('#g-selected-model').val('');
        if (this._selected) {
            this.$('#g-selected-model').val(this._selected.get('name'));
        }
        this._histogramView.getHistogram();
    },

    _selectItem: function (item) {
        if (!this.selectItem) {
            return;
        }
        this._resetSelection(item);
    },

    _selectModel: function () {
        if (this.selectItem) {
            return;
        }
        this._resetSelection(this._hierarchyView.parentModel);
    },

    validate: function (item) {
        if (!item || !item.has('largeImage')) {
            return $.Deferred().reject('Please select a "large image" item.').promise();
        }
        return $.Deferred().resolve().promise();
    },

    _validate: function () {
        // Validate selected element
        const selectedModel = this.selectedModel();
        let selectedValidation = this.validate(selectedModel);

        let invalidSelectedModel = null;
        $.when(selectedValidation.catch((failMessage) => {
            // selected-model is invalid
            invalidSelectedModel = failMessage;
            return undefined;
        })).done(() => {
            // Reset any previous error states
            this.$('.g-selected-model').removeClass('has-error');
            this.$('.g-validation-failed-message').addClass('hidden').html('');

            if (invalidSelectedModel) {
                this.$('.g-selected-model').addClass('has-error');
                this.$('.g-validation-failed-message').removeClass('hidden').text(invalidSelectedModel);
                return;
            }
            this.root = this._hierarchyView.parentModel;
            this.overlay.set({
                name: this.$('#h-overlay-name').val(),
                description: this.$('#h-overlay-description').val(),
                opacity: this.$('#h-overlay-opacity').val(),
                offset: {
                    x: parseFloat(this.$('#h-overlay-offset-x').val()),
                    y: parseFloat(this.$('#h-overlay-offset-y').val())
                },
                label: this.$('#h-overlay-label').prop('checked'),
                invertLabel: this.$('#h-overlay-invert-label').prop('checked'),
                flattenLabel: this.$('#h-overlay-flatten-label').prop('checked'),
                overlayItemId: selectedModel.id
            });
            this.trigger('g:submit');
            this.$el.modal('hide');
        });
    }
});

/**
 * Create a singleton instance of this widget that will be rendered
 * when `show` is called.
 */
var dialog = new SaveOverlay({
    parentView: null
});

function show(params, options) {
    _.defaults(options, {'title': 'Create overlay'});

    dialog.show(params, options);

    return dialog;
}

export default show;
