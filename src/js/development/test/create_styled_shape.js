(function () {
    gDevelopment.tests.push({
        title: 'Create Styled Shape',
        test: function test() {
            gApp.executeAction(GNewProjectAction.ID);
            var document = gApp.getActiveDocument();
            var scene = document.getScene();
            var page = scene.getActivePage();
            var layer = scene.getActiveLayer();

            var x = 20;
            var y = 20;
            var w = 500;// page.getProperty('w') - x * 2;
            var h = 500;//page.getProperty('h') - y * 2;

            var rectangle = new GRectangle();
            rectangle.setProperty('trf', new GTransform(w / 2, 0, 0, h / 2, x + w / 2, y + h / 2));

            var fillPatternTr = new GTransform()
                .translated(0.25, 0);

            rectangle.setProperties(['_bpt', '_fpt', '_fpx', '_bop', '_bw', '_sfop'], [new GBackground(), new GRadialGradient(null, 1, GMath.toRadians(45)), fillPatternTr, 1, 10, 1]);

            layer.appendChild(rectangle);
        }
    });
})();
