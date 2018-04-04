import _ from 'underscore';

import HierarchyWidget from 'girder/views/widgets/HierarchyWidget';
import RootSelectorWidget from 'girder/views/widgets/RootSelectorWidget';
import View from 'girder/views/View';

import BrowserWidget from 'girder/views/widgets/BrowserWidget';

import saveOverlay from '../templates/dialogs/saveOverlay.pug';

/**
 * Create a modal dialog with fields to edit the properties of
 * an overlay before POSTing it to the server.
 */
var SaveOverlay = View.extend({
    events: {
        'click .h-cancel': 'cancel',
        'submit form': 'save',
        'input #h-overlay-opacity': '_changeOpacity'
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

    render() {
        this.root = this.folder;
        this._rootSelectionView.selected = this.folder;
        // FIXME: move me
        this._opacity = this.overlay.get('opacity') || 1.0;
        this.$el.html(
            saveOverlay({
                title: this.options.title,
                name: this.overlay.get('name'),
                description: this.overlay.get('description'),
                label: this.overlay.get('label'),
                opacity: this.overlay.get('opacity'),
                help: this.helpText,
                preview: this.showPreview,
                selectItem: this.selectItem
            })
        ).girderModal(this);
        this._renderRootSelection();
        this._resetSelection(this.overlayItem);
        return this;
    },

    cancel(evt) {
        if (this.overlay) {
            this.overlay.set('opacity', this._opacity);
        }
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

    },

    _changeOpacity() {
        var opacity = this.$('#h-overlay-opacity').val();
        this.$('#h-overlay-opacity-label').text(`Overlay opacity ${(opacity * 100).toFixed()}%`);
        this.overlay.set('opacity', opacity);
    },

    selectedModel: function () {
        return this._selected;
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
        $.when(
            selectedValidation
                .catch((failMessage) => {
                    // selected-model is invalid
                    invalidSelectedModel = failMessage;
                    return undefined;
                })
        )
            .done(() => {
                // Reset any previous error states
                this.$('.g-selected-model').removeClass('has-error');
                this.$('.g-validation-failed-message').addClass('hidden').html('');

                if (invalidSelectedModel) {
                    this.$('.g-selected-model').addClass('has-error');
                    this.$('.g-validation-failed-message').removeClass('hidden').text(invalidSelectedModel);
                } else {
                    this.root = this._hierarchyView.parentModel;
                    this.overlay.set({
                        name: this.$('#h-overlay-name').val(),
                        description: this.$('#h-overlay-description').val(),
                        opacity: this.$('#h-overlay-opacity').val(),
                        label: this.$('#h-overlay-label').prop('checked'),
                        overlayItemId: selectedModel.id
                    });
                    this.trigger('g:submit');
                    this.$el.modal('hide');
                }
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

    dialog.overlay = params.overlay;

    dialog.folder = params.folder;
    dialog.overlayItem = params.overlayItem;

    dialog.options = options;

    dialog.setElement('#g-dialog-container').render();

    return dialog;
}

export default show;
