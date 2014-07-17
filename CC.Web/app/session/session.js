(function () {
    'use strict';

    var controllerId = 'sessions';

    // TODO: replace app with your module name
    angular.module('app').controller(controllerId,
        ['common', 'datacontext', sessions]);
    
    
    function sessions(common, datacontext) {
        console.log('datacontext',datacontext);
        var vm = this;

        var getLogFn = common.logger.getLogFn;
        var log = getLogFn(controllerId);

        vm.activate = activate;
        vm.sessions = [];
        vm.title = 'session';
        activate();

        function activate() {
            common.activateController([getSessions()], controllerId)
                .then(function () { log('Activated Session View'); });
        }

        function getSessions() {
            return datacontext.getSessionPartials().then(function (data) {
                return vm.sessions = data;
            }
        )}
    }
    
})();
