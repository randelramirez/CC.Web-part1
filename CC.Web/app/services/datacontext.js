(function () {
    'use strict';

    var serviceId = 'datacontext';
    angular.module('app').factory(serviceId, ['common', 'entityManagerFactory', 'model', datacontext]);

    function datacontext(common, emFactory, model) {

        /*
        An EntityQuery instance is used to query entities either from a remote datasource or from a local EntityManager.
        EntityQueries are immutable - this means that all EntityQuery methods that return an EntityQuery actually create a new EntityQuery. 
        This means that EntityQueries can be 'modified' without affecting any current instances.
       */
        var EntityQuery = breeze.EntityQuery;
        var Predicate = breeze.Predicate;
        var getLogFn = common.logger.getLogFn;
        var log = getLogFn(serviceId);
        var logError = getLogFn(serviceId, 'error');
        var logSuccess = getLogFn(serviceId, 'success');
        var entityNames = model.entityNames;

        // create entity manager
        /*Instances of the EntityManager contain and manage collections of entities, 
        either retrieved from a backend datastore or created on the client.*/
        var manager = emFactory.newManager();
        var primePromise;
        var $q = common.$q;

        var storeMeta = {
            isLoaded: {
                // note that speakers are included since we prime the data for it,
                // so there's no need to check, but it we include it if we want to
                sessions: false,
                attendees: false
            }
        };


        // notice that these are not resource(functions in the controller(breezecontroller))
        // but rather these are entity types

        var service = {
            getAttendeeCount: getAttendeeCount,
            getAttendees: getAttendees,
            getFilteredCount: getFilteredCount,
            getPeople: getPeople,
           // getSessionCount: getSessionCount,
            getSessionPartials: getSessionPartials,
           // getSpeakersLocal: getSpeakersLocal,
            getSpeakerPartials: getSpeakerPartials,
           // getSpeakersTopLocal: getSpeakersTopLocal,
            //getTrackCounts: getTrackCounts,
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

        function getAttendees(forceRemote, page, size, nameFilter) {
            var orderBy = 'firstName, lastName';
            //var attendees = [];

            var take = size || 20;
            var skip = page ? (page - 1) * size : 0;
            
            if (_areAttendeesLoaded() && !forceRemote) {
                //attendees = _getAllLocal(entityNames.attendee, orderBy);
                //return $q.when(attendees);

                // return only the data for a particular page
                return $q.when(getByPage());
            }

            // for initial load
            return EntityQuery.from('Persons')
                .select('id, firstName, lastName, imageSource')
                .orderBy(orderBy)
                .toType(entityNames.attendee)
                .using(manager).execute()
                .then(querySucceeded)
                .catch(_queryFailed);
                //.to$q(querySucceeded, _queryFailed);

            function getByPage() {
                var predicate = null;
                if (nameFilter) {
                    predicate = _fullNamePredicate(nameFilter);
                }
                var attendees = EntityQuery.from(entityNames.attendee)
                    //.select('id, firstName, lastName, imageSource') // not needed because it is already loaded locally so all needed properties are already there
                    //.toType(entityNames.attendee) not needed since it already in cache locally
                    .where(predicate)
                    .take(take)
                    .skip(skip)
                    .orderBy(orderBy)
                    .using(manager)
                    .executeLocally()
                // note that this happens synchronously, this is not a promise object
                // usage for those expecting a promise object $q.when(getByPage())
                return attendees;
                    //.to$q(querySucceeded, _queryFailed); // not needed because it is done locally
            }

            function querySucceeded(data) {
                _areAttendeesLoaded(true);
                log('Retrieved [Attendees] from remote data source', data.results.length, true);
                return getByPage();
            }
        }


        // notice that getSpeakerPartials doesn't have a checking if it has already been loaded
        // this is because we have primed the application, so the data is already been loaded right from the get go.
        // the only checking we do here if we are using a forceRemote
        function getSpeakerPartials(forceRemote) {
            var speakerOrderBy = 'firstName, lastName';
            var speakers = [];

            // additional checking isSpeaker since it will look for the Person entity
            // isSpeaker => see model.js
            var predicate = breeze.Predicate.create('isSpeaker', '==', true);

            if (!forceRemote) {
                speakers = _getAllLocal(entityNames.speaker, speakerOrderBy, predicate);
                return $q.when(speakers);
            }

            return EntityQuery.from('Speakers')
                .select('id, firstName, lastName, imageSource')
                .orderBy(speakerOrderBy)
                .toType(entityNames.speaker)
                .using(manager).execute()
                .to$q(querySucceeded, _queryFailed);

            function querySucceeded(data) {
                speakers = data.results;
                // set the items as speakers
                for (var i = speakers.length; i--;){
                    speakers[i].isSpeaker = true;
                }
                log('Retrieved [Speaker Partials] from remote data source', speakers.length, true);
                return speakers;
            }
        }

        function getSessionPartials(forceRemote) {
            var orderBy = 'timeSlotId, level, speaker.firstName';
            var sessions;

            if (_areSessionsLoaded() && !forceRemote) {
                sessions = _getAllLocal(entityNames.session, orderBy);
                // note, the local data is retrieved synchronously, so it doesn't return a promise
                // but in the controller,  datacontext.getSessionPartials().then() expects the return 
                // of this function to be a promise, so we wrap the sessions variable inside a promise
                // $q.when() resolves the promise back
                return $q.when(sessions);
            }

            return EntityQuery.from('Sessions')
                .select('id, title, code, speakerId, trackId, timeSlotId, roomId, level, tags')
                .orderBy(orderBy)
                // toType tells breeze what entity type to use for the projection
                .toType(entityNames.session)
                .using(manager).execute()
                .then(querySucceeded)
                .catch(_queryFailed);

            // .then(querySucceeded)
            //   .catch(queryFailed)
            //.finally();
            // translate q promises for breeze, to $q promises for angular
            //.to$q(querySucceeded, queryFailed);

            function querySucceeded(data) {
                sessions = data.results;
                _areSessionsLoaded(true);
                log('Retrieved [Session Partials] from remote data source', sessions.length, true);
                return sessions;
            }
        }

        // this function is called in app.js
        function prime() {
            if (primePromise) return primePromise;

            // accepts an array of promise
            // $q.all, wait for both to finish
            // getSpeakerPartials, make sure that it comes from the server, note that prime is called on start of the application
            primePromise = $q.all([getLookups(), getSpeakerPartials(true)])
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
                // set these entity types as Person (note that Person exists in the backend)
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

        function getAttendeeCount() {
            if (_areAttendeesLoaded()) {
                return $q.when(_getLocalEntityCount(entityNames.attendee));
            }
            // Attendees aren't loaded; ask the server for a count.
            return EntityQuery.from('Persons').take(0).inlineCount()
                .using(manager).execute()
                .to$q(_getInlineCount);
        }

        function getFilteredCount(nameFilter) {
            var predicate = _fullNamePredicate(nameFilter);

            var attendees = EntityQuery.from(entityNames.attendee)
                .where(predicate)
                .using(manager)
                .executeLocally();

            return attendees.length;
        }

        function getLookups() {
            // breeze is aware that Lookups is only a resource and not an entity
            return EntityQuery.from('Lookups')
                .using(manager).execute()
                .to$q(querySucceeded, _queryFailed);

            // after breeze has retrieved the data from the server, it will cache the data locally in memory
            // do nothing, just log
            function querySucceeded(data) {
                log('Retrieved [Lookups]', data, true);
                return true;
            }
        }

        function _getInlineCount(data) { return data.inlineCount; }

        function _getAllLocal(resource, ordering, predicate) {
            return EntityQuery.from(resource)
                .orderBy(ordering)
                .where(predicate)
                .using(manager)
                .executeLocally();
        }


        // if value is passed, we are setting it // set
        // if value is not passed, we are getting it // get
        function _areSessionsLoaded(value) {
            return _areItemsLoaded('sessions', value);
        }

        function _areAttendeesLoaded(value) {
            return _areItemsLoaded('attendees', value);
        }

        function _areItemsLoaded(key, value) {
            if (value === undefined) {
                return storeMeta.isLoaded[key]; // get
            }
            return storeMeta.isLoaded[key] = value; // set
        }

        function _queryFailed(error) {
            var msg = config.appErrorPrefix + 'Error retreiving data.' + error.message;
            logError(msg, error);
            throw error;
        }

        function _fullNamePredicate(filterValue) {
            return Predicate
                .create('firstName', 'contains', filterValue)
                .or('lastName', 'contains', filterValue);
        }

        function _getLocalEntityCount(resource) {
            var entities = EntityQuery.from(resource)
                .using(manager)
                .executeLocally();
            return entities.length;
        }
    }
})();