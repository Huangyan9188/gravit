(function (_) {
    /**
     * The base marquee select tool
     * @param {IFMarqueeTool._AreaSelector} areaSelector
     * @class IFMarqueeTool
     * @extends IFTool
     * @constructor
     */
    function IFMarqueeTool(areaSelector) {
        IFTool.call(this);
        this._areaSelector = areaSelector;
    };

    IFObject.inherit(IFMarqueeTool, IFTool);

    // -----------------------------------------------------------------------------------------------------------------
    // IFMarqueeTool._AreaSelector Class
    // -----------------------------------------------------------------------------------------------------------------
    /**
     * @class IFMarqueeTool._AreaSelector
     * @private
     */
    IFMarqueeTool._AreaSelector = function () {
        this._vertexContainer = new IFVertexContainer();
        this._pixelTransformer = new IFVertexPixelAligner(this._vertexContainer);
    };

    /**
     * @type {IFVertexContainer}
     * @private
     */
    IFMarqueeTool._AreaSelector.prototype._vertexContainer = null;

    /**
     * @type {IFVertexPixelAligner}
     * @private
     */
    IFMarqueeTool._AreaSelector.prototype._pixelTransformer = null;

    /**
     * Called when this selector should return it's selection area bounds
     * @return {IFRect} the area bounds
     */
    IFMarqueeTool._AreaSelector.prototype.getAreaBounds = function () {
        return ifVertexInfo.calculateBounds(this._pixelTransformer, false);
    };

    /**
     * Called when this selector should begin selecting
     */
    IFMarqueeTool._AreaSelector.prototype.begin = function () {
        this._vertexContainer.clearVertices();
    };

    /**
     * Called when this selector should finish selecting
     */
    IFMarqueeTool._AreaSelector.prototype.finish = function () {
        // NO-OP
    };

    /**
     * Called when this selector should start on a given position
     * @param {IFPoint} pos the current position
     */
    IFMarqueeTool._AreaSelector.prototype.start = function (pos) {
        // NO-OP
    };

    /**
     * Called when this selector should move on a given position
     * @param {IFPoint} pos the current position
     */
    IFMarqueeTool._AreaSelector.prototype.move = function (pos) {
        // NO-OP
    };

    /**
     * Called when this selector should paint itself
     * @param {IFPaintContext} context
     */
    IFMarqueeTool._AreaSelector.prototype.paint = function (context) {
        context.canvas.putVertices(this._pixelTransformer);
        context.canvas.strokeVertices(IFRGBColor.BLACK);
    };


    // -----------------------------------------------------------------------------------------------------------------
    // IFMarqueeTool Class
    // -----------------------------------------------------------------------------------------------------------------

    /**
     * The current Area-Selector
     * @type {IFMarqueeTool._AreaSelector}
     * @private
     */
    IFMarqueeTool.prototype._areaSelector = null;

    /**
     * The current area selector bounds
     * @type {IFRect}
     * @private
     */
    IFMarqueeTool.prototype._areaBounds = null;

    /** @override */
    IFMarqueeTool.prototype.activate = function (view) {
        IFTool.prototype.activate.call(this, view);

        view.addEventListener(IFMouseEvent.DragStart, this._mouseDragStart, this);
        view.addEventListener(IFMouseEvent.Drag, this._mouseDrag, this);
        view.addEventListener(IFMouseEvent.DragEnd, this._mouseDragEnd, this);
        view.addEventListener(IFMouseEvent.Down, this._mouseDown, this);
        view.addEventListener(IFMouseEvent.Release, this._mouseRelease, this);

        ifPlatform.addEventListener(GUIPlatform.ModifiersChangedEvent, this._modifiersChanged, this);
    };

    /** @override */
    IFMarqueeTool.prototype.deactivate = function (view) {
        IFTool.prototype.deactivate.call(this, view);

        view.removeEventListener(IFMouseEvent.DragStart, this._mouseDragStart);
        view.removeEventListener(IFMouseEvent.Drag, this._mouseDrag);
        view.removeEventListener(IFMouseEvent.DragEnd, this._mouseDragEnd);
        view.removeEventListener(IFMouseEvent.Down, this._mouseDown);
        view.removeEventListener(IFMouseEvent.Release, this._mouseRelease);

        ifPlatform.removeEventListener(GUIPlatform.ModifiersChangedEvent, this._modifiersChanged);
    };

    /** @override */
    IFMarqueeTool.prototype.isDeactivatable = function () {
        // cannot deactivate while dragging
        return !this._areaBounds;
    };

    /** @override */
    IFMarqueeTool.prototype.paint = function (context) {
        if (this._areaBounds) {
            this._areaSelector.paint(context);
        }
    };

    /**
     * @param {IFMouseEvent.Down} event
     * @private
     */
    IFMarqueeTool.prototype._mouseDown = function (event) {
        // Quit if not hitting the left-mouse-button
        if (event.button !== IFMouseEvent.BUTTON_LEFT) {
            return;
        }

        // Let editor do some work for mouse position
        this._editor.updateByMousePosition(event.client, this._view.getWorldTransform());
    };

    /**
     * @param {IFMouseEvent.Release} event
     * @private
     */
    IFMarqueeTool.prototype._mouseRelease = function (event) {
        if (!this._areaBounds || this._areaBounds.isEmpty()) {
            this._editor.clearSelection();
        } else if (this._areaBounds && !this._areaBounds.isEmpty()) {
            // Invalidate to remove area selector's paint region
            var bounds = this._areaBounds;
            this._areaBounds = null; // reset to prevent repainting
            this.invalidateArea(bounds);
        } else {
            this._areaBounds = null;
        }
    };

    /**
     * @param {IFMouseEvent.DragStart} event
     * @private
     */
    IFMarqueeTool.prototype._mouseDragStart = function (event) {
        this._areaSelector.begin();
        this._areaSelector.start(event.client);
    };

    /**
     * @param {IFMouseEvent.Drag} event
     * @private
     */
    IFMarqueeTool.prototype._mouseDrag = function (event) {
        if (this._areaBounds) {
            this.invalidateArea(this._areaBounds);
        }

        this._areaSelector.move(event.client);
        this._updateAreaBoundsAndInvalidate();
    };

    /**
     * @param {IFMouseEvent.DragEnd} event
     * @private
     */
    IFMarqueeTool.prototype._mouseDragEnd = function (event) {
        if (this._areaBounds) {
            // our area selector selected something
            var collisionArea = new IFVertexTransformer(this._areaSelector._pixelTransformer, this._view.getViewTransform());
            var collisionsAcceptor = function (element) {
                // By default, we allow only items to be selected.
                return (element instanceof IFItem);
            };
            var collisions = this._scene.getCollisions(collisionArea,
                IFElement.CollisionFlag.GeometryBBox | IFElement.CollisionFlag.Partial, collisionsAcceptor);

            this._editor.updateSelectionUnderCollision(ifPlatform.modifiers.shiftKey, collisions, collisionArea);
        }
        this._areaSelector.finish();
    };

    /**
     * @param {GUIPlatform.ModifiersChangedEvent} event
     * @private
     */
    IFMarqueeTool.prototype._modifiersChanged = function (event) {
        // TODO
    };

    /**
     * @private
     */
    IFMarqueeTool.prototype._updateAreaBoundsAndInvalidate = function () {
        this._areaBounds = this._areaSelector.getAreaBounds();
        if (this._areaBounds && this._areaBounds.isEmpty()) {
            this._areaBounds = null;
        }

        if (this._areaBounds) {
            // Accreditate for 1px tolerance (AA)
            this._areaBounds = this._areaBounds.expanded(1, 1, 1, 1);

            this.invalidateArea(this._areaBounds);
        }
    };

    /** override */
    IFMarqueeTool.prototype.toString = function () {
        return "[Object IFMarqueeTool]";
    };

    _.IFMarqueeTool = IFMarqueeTool;
})(this);