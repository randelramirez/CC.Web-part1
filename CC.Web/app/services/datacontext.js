(function () {
    'use strict';

    var serviceId = 'datacontext';
    angular.module('app').factory(serviceId, ['common', 'entityManagerFactory', datacontext]);

    function datacontext(common, emFactory) {

        /*
        An EntityQuery instance is used to query entities either from a remote datasource or from a local EntityManager.
        EntityQueries are immutable - this means that all EntityQuery methods that return an EntityQuery actually create a new EntityQuery. 
        This means that EntityQueries can be 'modified' without affecting any current instances.
       */
        var EntityQuery = breeze.EntityQuery;
        var getLogFn = common.logger.getLogFn;
        var log = getLogFn(serviceId);
        var logError = getLogFn(serviceId, 'error');
        var logSuccess = getLogFn(serviceId, 'success');


        // create entity manager
        /*Instances of the EntityManager contain and manage collections of entities, 
        either retrieved from a backend datastore or created on the client.*/
        var manager = emFactory.newManager();
        var primePromise;
        var $q = common.$q;


        // notice that these are not resource(functions in the controller(breezecontroller))
        // but rather these are entity types
        var entityNames = {
            attendee: 'Person',
            person: 'Person',
            speaker: 'Person',
            session: 'Session',
            room: 'Room',
            track: 'Track',
            timeslot: 'TimeSlot'
        };

        var service = {
            getPeople: getPeople,
            getMessageCount: getMessageCount,
            getSessionPartials: getSessionPartials,
            getSpeakerPartials: getSpeakerPartials,
            prime: prime
        };

        return service;

        function getMessageCount() { return $q.when(72); }

        function getPeople() {
            var people = [
                { firstName: 'John', lastName: 'Papa', age: 25, location: 'Florida' },
                { firstName: 'Ward', lastName: 'Bell', age: 31, location: 'California' },
                { firstName: 'Colleen', lastName: 'Jones', age: 21, location: 'New York' },
                { firstName: 'Madelyn', lastName: 'Green', age: 18, location: 'North Dakota' },
                { firstName: 'Ella', lastName: 'Jobs', age: 18, location: 'South Dakota' },
                { firstName: 'Landon', lastName: 'Gates', age: 11, location: 'South Carolina' },
                { firstName: 'Haley', lastName: 'Guthrie', age: 35, location: 'Wyoming' }
            ];
            return $q.when(people);
        }

        function getSpeakerPartials() {
            var speakerOrderBy = 'firstName, lastName';
            var speakers = [];

            return EntityQuery.from('Speakers')
                .select('id, firstName, lastName, imageSource')
                .orderBy(speakerOrderBy)
                .toType('Person')
                .using(manager).execute()
                .to$q(querySucceeded, _queryFailed);

            function querySucceeded(data) {
                speakers = data.results;
                // true= show alert on screen as well
                log('Retrieved [Speaker Partials] from remote data source', speakers.length, true);
                return speakers;
            }
        }

        function getSessionPartials() {
            var orderBy = 'timeSlotId, level, speaker.firstName';
            var sessions;

            return EntityQuery.from('Sessions')
                .select('id, title, code, speakerId, trackId, timeSlotId, roomId, level, tags')
                .orderBy(orderBy)
                // toType tells breeze what entity type to use for the projection
                .toType('Session')
                .using(manager).execute()
                .to$q(querySucceeded, _queryFailed);

            // .then(querySucceeded)
            //   .catch(queryFailed)
            //.finally();
            // translate q promises for breeze, to $q promises for angular
            //.to$q(querySucceeded, queryFailed);

            function querySucceeded(data) {
                sessions = data.results;
                log('Retrieved [Session Partials] from remote data source', sessions.length, true);
                return sessions;
            }
        }

        // this function is called in app.js
        function prime() {
            if (primePromise) return primePromise;

            // accepts an array of promise
            primePromise = $q.all([getLookups(), getSpeakerPartials()])
            .then(extendMetadata)
            .then(success);
            return primePromise;

            function success() {
                setLookups();
                log('Primed the data');
            }

            // Breeze's metadata store contains information about the entries
            function extendMetadata() {
                var metadataStore = manager.metadataStore;
                var types = metadataStore.getEntityTypes();
                types.forEach(function (type) {
                    if (type instanceof breeze.EntityType) {
                        set(type.shortName, type);
                    }
                });

                var personEntityName = entityNames.person;
                // set these entity types as Person (note that person exists in the backend)
                ['Speakers', 'Speaker', 'Attendees', 'Attendee'].forEach(function (r) {
                    set(r, personEntityName);
                });

                function set(resourceName, entityName) {
                    metadataStore.setEntityTypeForResourceName(resourceName, entityName);
                }
            }
        }

        // cache the data
        function setLookups() {
            service.lookupCachedData = {
                rooms: _getAllLocal(entityNames.room, 'name'),
                tracks: _getAllLocal(entityNames.track, 'name'),
                timeslots: _getAllLocal(entityNames.timeslot, 'start'),
            };
        }

        function _getAllLocal(resource, ordering) {
            return EntityQuery.from(resource)
                .orderBy(ordering)
                .using(manager)
                .executeLocally();
        }

        function getLookups() {
            // breeze is aware that Lookups is only a resource and not an entity
            return EntityQuery.from('Lookups')
                .using(manager).execute()
                .to$q(querySucceeded, _queryFailed);

            // do nothing, just log
            // after breeze has retrieved the data from the server, it will cache the data locally in memory
            function querySucceeded(data) {
                log('Retrieved [Lookups]', data, true);
                return true;
            }
        }

        function _queryFailed(error) {
            var msg = config.appErrorPrefix + 'Error retreiving data.' + error.message;
            logError(msg, error);
            throw error;
        }
    }
})();