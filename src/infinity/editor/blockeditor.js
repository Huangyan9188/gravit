(function (_) {
    /**
     * A base editor for shapes
     * @param {GXBlock} block the block this editor works on
     * @class GXBlockEditor
     * @extends GXElementEditor
     * @constructor
     */
    function GXBlockEditor(block) {
        GXElementEditor.call(this, block);
    };
    GObject.inherit(GXBlockEditor, GXElementEditor);

    GXBlockEditor.Flag = {
        /**
         * The editor supports edge resize handles
         * @type Number
         */
        ResizeEdges: 1 << 10,

        /**
         * The editor supports center resize handles
         * @type Number
         */
        ResizeCenters: 1 << 11,

        /**
         * The editor supports all resize handles
         * @type Number
         */
        ResizeAll: (1 << 10) | (1 << 11)
    };

    GXBlockEditor.RESIZE_HANDLE_PART_ID = gUtil.uuid();

    /** @override */
    GXBlockEditor.prototype.getBBoxMargin = function () {
        if (this._showResizeHandles()) {
            return GXElementEditor.OPTIONS.annotationSizeSmall + 1;
        }
        return GXElementEditor.prototype.getBBoxMargin.call(this);
    };

    /** @override */
    GXBlockEditor.prototype.movePart = function (partId, partData, position, viewToWorldTransform, shift, option) {
        GXElementEditor.prototype.movePart.call(this, partId, partData, position, viewToWorldTransform, shift, option);

        if (partId === GXBlockEditor.RESIZE_HANDLE_PART_ID) {
            var newPos = viewToWorldTransform.mapPoint(position);
            var sourceBBox = this._element.getGeometryBBox();
            var width = sourceBBox.getWidth();
            var height = sourceBBox.getHeight();

            var dx = 0;
            var dy = 0;
            var sx = 1;
            var sy = 1;
            var tx = 0;
            var ty = 0;

            // Calculate horizontal factors
            switch (partData.side) {
                case GRect.Side.TOP_LEFT:
                case GRect.Side.LEFT_CENTER:
                case GRect.Side.BOTTOM_LEFT:
                    dx = partData.point.getX() - newPos.getX();
                    tx = -dx;
                    sx = (width + dx) / width;
                    if (option) {
                        sx += sx - 1;
                    }
                    break;
                case GRect.Side.TOP_RIGHT:
                case GRect.Side.RIGHT_CENTER:
                case GRect.Side.BOTTOM_RIGHT:
                    dx = newPos.getX() - partData.point.getX();
                    sx = (width + dx) / width;
                    if (option) {
                        sx += sx - 1;
                        tx = -dx;
                    }
                    break;
                default:
                    break;
            }

            // Calculate vertical factors
            switch (partData.side) {
                case GRect.Side.TOP_LEFT:
                case GRect.Side.TOP_CENTER:
                case GRect.Side.TOP_RIGHT:
                    dy = partData.point.getY() - newPos.getY();
                    ty = -dy;
                    sy = (height + dy) / height;
                    if (option) {
                        sy += sy - 1;
                    }
                    break;
                case GRect.Side.BOTTOM_LEFT:
                case GRect.Side.BOTTOM_CENTER:
                case GRect.Side.BOTTOM_RIGHT:
                    dy = newPos.getY() - partData.point.getY();
                    sy = (height + dy) / height;
                    if (option) {
                        sy += sy - 1;
                        ty = -dy;
                    }
                    break;
                default:
                    break;
            }

            // Honor shift
            // TODO : This code needs fixing for translations + sign of scaling
            if (shift) {
                switch (partData.side) {
                    case GRect.Side.TOP_LEFT:
                    case GRect.Side.TOP_RIGHT:
                    case GRect.Side.BOTTOM_LEFT:
                    case GRect.Side.BOTTOM_RIGHT:
                        // Make equal width / height for edge resize
                        var newWidth = Math.abs(sourceBBox.getWidth() * sx);
                        var newHeight = Math.abs(sourceBBox.getHeight() * sy);
                        if (newWidth > newHeight) {
                            sy = (newWidth / sourceBBox.getHeight());
                        } else {
                            sx = (newHeight / sourceBBox.getWidth());
                        }
                        break;
                    case GRect.Side.TOP_CENTER:
                    case GRect.Side.BOTTOM_CENTER:
                    case GRect.Side.LEFT_CENTER:
                    case GRect.Side.RIGHT_CENTER:
                        // Make equal delta for center resize
                        if (sx > sy) {
                            sy = sx;
                        } else {
                            sx = sy;
                        }
                    default:
                        break;
                }
            }

            var transform = new GTransform(1, 0, 0, 1, -sourceBBox.getX(), -sourceBBox.getY())
                .multiplied(new GTransform(sx, 0, 0, sy, 0, 0))
                .multiplied(new GTransform(1, 0, 0, 1, +sourceBBox.getX() + tx, +sourceBBox.getY() + ty));

            this.transform(transform);
        }
    };

    /** @override */
    GXBlockEditor.prototype.applyPartMove = function (partId, partData) {
        if (partId === GXBlockEditor.RESIZE_HANDLE_PART_ID) {
            this.applyTransform(this._element);
        }
        GXElementEditor.prototype.applyPartMove.call(this, partId, partData);
    };

    /** @override */
    GXBlockEditor.prototype.paint = function (transform, context) {
        if (this.hasFlag(GXElementEditor.Flag.Selected) || this.hasFlag(GXElementEditor.Flag.Highlighted)) {
            var targetTransform = transform;

            // Pre-multiply internal transformation if any
            if (this._transform) {
                targetTransform = this._transform.multiplied(transform);
            }

            // Let descendant classes do some pre-painting
            this._prePaint(targetTransform, context);

            // Paint resize handles if desired
            if (this._showResizeHandles()) {
                this._iterateResizeHandles(function (point, side) {
                    this._paintAnnotation(context, transform, point, GXElementEditor.Annotation.Rectangle, false, true);
                }.bind(this), true);
            }

            // Let descendant classes do some post-painting
            this._postPaint(targetTransform, context);
        }

        // Paint any children editors now
        this._paintChildren(transform, context);
    };

    /** @override */
    GXBlockEditor.prototype._getPartInfoAt = function (location, transform, tolerance) {
        // Hit-Test our resize handles if any
        if (this._showResizeHandles()) {
            var result = null;
            this._iterateResizeHandles(function (point, side) {
                if (this._getAnnotationBBox(transform, point).expanded(tolerance, tolerance, tolerance, tolerance).containsPoint(location)) {
                    result = new GXElementEditor.PartInfo(this, GXBlockEditor.RESIZE_HANDLE_PART_ID, {side: side, point: point}, true, false);
                    return true;
                }
            }.bind(this), true);

            if (result) {
                return result;
            }
        }

        return null;
    };

    /**
     * Called for subclasses to do some custom painting beneath of the outline
     * @param {GTransform} transform the current transformation in use
     * @param {GXPaintContext} context the paint context to paint on
     * @private
     */
    GXBlockEditor.prototype._prePaint = function (transform, context) {
        // NO-OP
    };

    /**
     * Called for subclasses to do some custom painting on top of the outline
     * @param {GTransform} transform the current transformation in use
     * @param {GXPaintContext} context the paint context to paint on
     * @private
     */
    GXBlockEditor.prototype._postPaint = function (transform, context) {
        // NO-OP
    };

    /**
     * @returns {Boolean}
     * @private
     */
    GXBlockEditor.prototype._showResizeHandles = function () {
        return this._showAnnotations() && (this.hasFlag(GXBlockEditor.Flag.ResizeEdges) || this.hasFlag(GXBlockEditor.Flag.ResizeCenters));
    };

    /**
     * Iterate all resize handles
     * @param {Function(point: GPoint, side: GRect.Side)} iterator
     * the iterator receiving the parameters. If this returns true then the iteration will be stopped.
     */
    GXBlockEditor.prototype._iterateResizeHandles = function (iterator) {
        var bbox = this.getPaintElement().getGeometryBBox();

        if (bbox && !bbox.isEmpty()) {
            var sides = [];

            if (this.hasFlag(GXBlockEditor.Flag.ResizeEdges)) {
                sides = sides.concat([GRect.Side.TOP_LEFT, GRect.Side.TOP_RIGHT, GRect.Side.BOTTOM_LEFT, GRect.Side.BOTTOM_RIGHT]);
            }

            if (this.hasFlag(GXBlockEditor.Flag.ResizeCenters)) {
                sides = sides.concat([GRect.Side.TOP_CENTER, GRect.Side.RIGHT_CENTER, GRect.Side.BOTTOM_CENTER, GRect.Side.LEFT_CENTER]);
            }

            for (var i = 0; i < sides.length; ++i) {
                var side = sides[i];
                var point = bbox.getSide(side);
                if (iterator(point, side) === true) {
                    break;
                }
            }
        }
    };

    /** @override */
    GXBlockEditor.prototype.toString = function () {
        return "[Object GXBlockEditor]";
    };

    _.GXBlockEditor = GXBlockEditor;
})(this);