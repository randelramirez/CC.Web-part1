(function () {
    'use strict';

    var controllerId = 'sessions';

    // TODO: replace app with your module name
    angular.module('app').controller(controllerId,
        ['common', 'datacontext', 'config', sessions]);
    
    
    function sessions(common, datacontext, config) {
        var vm = this;
        vm.filteredSessions = [];
        var keyCodes = config.keyCodes;
        vm.search = search;
        vm.sessionsFilter = sessionsFilter;
        vm.sessionsSearch = ''; //$routeParams.search || '';
        var applyFilter = function () { };
        var getLogFn = common.logger.getLogFn;
        var log = getLogFn(controllerId);

        vm.sessions = [];
        vm.title = 'session';
        vm.refresh = refresh;
        activate();

        function activate() {
            // getSessions has was not passed a parameter for forceRefresh, effect is same as passing false
            common.activateController([getSessions()], controllerId)
                .then(function () {
                    applyFilter = common.createSearchThrottle(vm, 'sessions');
                    if (vm.sessionsSearch) {
                        // on startup skip the delay
                        applyFilter(true);
                    }
                    log('Activated Session View');
                });
        }

        function getSessions(forceRefresh) {
            return datacontext.getSessionPartials(forceRefresh).then(function (data) {
                applyFilter(true);
                return vm.sessions = vm.filteredSessions = data;
            }
        )}

        function refresh() { getSessions(true); }

        function search($event) {
            if ($event.keyCode === keyCodes.esc) {
                vm.sessionsSearch = '';
                applyFilter(true);
            } else {
                applyFilter();
            }
        }

        function sessionsFilter(session) {
            var textContains = common.textContains;
            var searchText = vm.sessionsSearch;
            var isMatch = searchText ?
                textContains(session.title, searchText)
                    || textContains(session.tagsFormatted, searchText)
                    || textContains(session.room.name, searchText)
                    || textContains(session.track.name, searchText)
                    || textContains(session.speaker.fullName, searchText)
                : true;
            return isMatch;
        }
    }
    
})();
