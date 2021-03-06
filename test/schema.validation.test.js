/**
 * Module dependencies.
 */

var start = require('./common')
  , mongoose = start.mongoose
  , assert = require('assert')
  , Schema = mongoose.Schema
  , Document = mongoose.Document
  , SchemaType = mongoose.SchemaType
  , VirtualType = mongoose.VirtualType
  , ValidatorError = mongoose.Error.ValidatorError
  , SchemaTypes = Schema.Types
  , ObjectId = SchemaTypes.ObjectId
  , Mixed = SchemaTypes.Mixed
  , DocumentObjectId = mongoose.Types.ObjectId
  , MongooseArray = mongoose.Types.Array
  , ReadPref = require('mquery').utils.mongo.ReadPreference
  , vm = require('vm')
  , random = require('../lib/utils').random

describe('schema', function(){
  describe('validation', function(){
    it('invalid arguments are rejected (1044)', function(done){
      assert.throws(function () {
        new Schema({
            simple: { type: String, validate: 'nope' }
        });
      }, /Invalid validator/);

      assert.throws(function () {
        new Schema({
            simple: { type: String, validate: ['nope'] }
        });
      }, /Invalid validator/);

      assert.throws(function () {
        new Schema({
          simple: { type: String, validate: { nope: 1, msg: 'nope' } }
        });
      }, /Invalid validator/);

      assert.throws(function () {
        new Schema({
          simple: { type: String, validate: [{ nope: 1, msg: 'nope' }, 'nope'] }
        });
      }, /Invalid validator/);

      done();
    })

    it('string enum', function(done){
      var Test = new Schema({
          complex: { type: String, enum: ['a', 'b', undefined, 'c', null] }
      });

      assert.ok(Test.path('complex') instanceof SchemaTypes.String);
      assert.deepEqual(Test.path('complex').enumValues,['a', 'b', 'c', null]);
      assert.equal(Test.path('complex').validators.length, 1)

      Test.path('complex').enum('d', 'e');

      assert.deepEqual(Test.path('complex').enumValues, ['a', 'b', 'c', null, 'd', 'e']);

      Test.path('complex').doValidate('x', function(err){
        assert.ok(err instanceof ValidatorError);
      });

      // allow unsetting enums
      Test.path('complex').doValidate(undefined, function(err){
        assert.ifError(err);
      });

      Test.path('complex').doValidate(null, function(err){
        assert.ifError(err);
      });

      Test.path('complex').doValidate('da', function(err){
        assert.ok(err instanceof ValidatorError);
      })

      done();
    })

    it('string regexp', function(done){
      var Test = new Schema({
          simple: { type: String, match: /[a-z]/ }
      });

      assert.equal(1, Test.path('simple').validators.length);

      Test.path('simple').doValidate('az', function(err){
        assert.ifError(err);
      });

      Test.path('simple').match(/[0-9]/);
      assert.equal(2, Test.path('simple').validators.length);

      Test.path('simple').doValidate('12', function(err){
        assert.ok(err instanceof ValidatorError);
      });

      Test.path('simple').doValidate('a12', function(err){
        assert.ifError(err);
      });

      Test.path('simple').doValidate('', function(err){
        assert.ifError(err);
      });
      Test.path('simple').doValidate(null, function(err){
        assert.ifError(err);
      });
      Test.path('simple').doValidate(undefined, function(err){
        assert.ifError(err);
      });
      Test.path('simple').validators = [];
      Test.path('simple').match(/[1-9]/);
      Test.path('simple').doValidate(0, function(err){
        assert.ok(err instanceof ValidatorError);
      });
      done();
    })

    it('number min and max', function(done){
      var Tobi = new Schema({
          friends: { type: Number, max: 15, min: 5 }
      });

      assert.equal(Tobi.path('friends').validators.length, 2);

      Tobi.path('friends').doValidate(10, function(err){
        assert.ifError(err);
      });

      Tobi.path('friends').doValidate(100, function(err){
        assert.ok(err instanceof ValidatorError);
        assert.equal('friends', err.path);
        assert.equal('max', err.type);
        assert.equal(100, err.value);
      });

      Tobi.path('friends').doValidate(1, function(err){
        assert.ok(err instanceof ValidatorError);
      });

      // null is allowed
      Tobi.path('friends').doValidate(null, function(err){
        assert.ifError(err);
      });

      Tobi.path('friends').min();
      Tobi.path('friends').max();

      assert.equal(Tobi.path('friends').validators.length, 0);
      done();
    });

    describe('required', function(){
      it('string required', function(done){
        var Test = new Schema({
            simple: String
        });

        Test.path('simple').required(true);
        assert.equal(Test.path('simple').validators.length, 1);

        Test.path('simple').doValidate(null, function(err){
          assert.ok(err instanceof ValidatorError);
        });

        Test.path('simple').doValidate(undefined, function(err){
          assert.ok(err instanceof ValidatorError);
        });

        Test.path('simple').doValidate('', function(err){
          assert.ok(err instanceof ValidatorError);
        });

        Test.path('simple').doValidate('woot', function(err){
          assert.ifError(err);
        });

        done();
      });

    it('number required', function(done){
      var Edwald = new Schema({
          friends: { type: Number, required: true }
      });

      Edwald.path('friends').doValidate(null, function(err){
        assert.ok(err instanceof ValidatorError);
      });

      Edwald.path('friends').doValidate(undefined, function(err){
        assert.ok(err instanceof ValidatorError);
      });

      Edwald.path('friends').doValidate(0, function(err){
        assert.ifError(err);
      });

      done();
    })

      it('date required', function(done){
        var Loki = new Schema({
            birth_date: { type: Date, required: true }
        });

        Loki.path('birth_date').doValidate(null, function (err) {
          assert.ok(err instanceof ValidatorError);
        });

        Loki.path('birth_date').doValidate(undefined, function (err) {
          assert.ok(err instanceof ValidatorError);
        });

        Loki.path('birth_date').doValidate(new Date(), function (err) {
          assert.ifError(err);
        });

        done();
      });

      it('objectid required', function(done){
        var Loki = new Schema({
            owner: { type: ObjectId, required: true }
        });

        Loki.path('owner').doValidate(new DocumentObjectId(), function(err){
          assert.ifError(err);
        });

        Loki.path('owner').doValidate(null, function(err){
          assert.ok(err instanceof ValidatorError);
        });

        Loki.path('owner').doValidate(undefined, function(err){
          assert.ok(err instanceof ValidatorError);
        });
        done();
      });

      it('array required', function(done){
        var Loki = new Schema({
            likes: { type: Array, required: true }
        });

        Loki.path('likes').doValidate(null, function (err) {
          assert.ok(err instanceof ValidatorError);
        });

        Loki.path('likes').doValidate(undefined, function (err) {
          assert.ok(err instanceof ValidatorError);
        });

        Loki.path('likes').doValidate([], function (err) {
          assert.ok(err instanceof ValidatorError);
        });
        done();
      });

      it('boolean required', function(done){
        var Animal = new Schema({
            isFerret: { type: Boolean, required: true }
        });

        Animal.path('isFerret').doValidate(null, function(err){
          assert.ok(err instanceof ValidatorError);
        });

        Animal.path('isFerret').doValidate(undefined, function(err){
          assert.ok(err instanceof ValidatorError);
        });

        Animal.path('isFerret').doValidate(true, function(err){
          assert.ifError(err);
        });

        Animal.path('isFerret').doValidate(false, function(err){
          assert.ifError(err);
        });
        done();
      });

      it('mixed required', function(done){
          var Animal = new Schema({
            characteristics: { type: Mixed, required: true }
          });

          Animal.path('characteristics').doValidate(null, function(err){
            assert.ok(err instanceof ValidatorError);
          });

          Animal.path('characteristics').doValidate(undefined, function(err){
            assert.ok(err instanceof ValidatorError);
          });

          Animal.path('characteristics').doValidate({
            aggresive: true
          }, function(err){
            assert.ifError(err);
          });

          Animal.path('characteristics').doValidate('none available', function(err){
            assert.ifError(err);
          });
          done();
      })
    })

    describe('async', function(){
      it('works', function(done){
        var executed = 0;

        function validator (value, fn) {
          setTimeout(function(){
            executed++;
            fn(value === true);
            if (2 === executed) done();
          }, 5);
        };

        var Animal = new Schema({
            ferret: { type: Boolean, validate: validator }
        });

        Animal.path('ferret').doValidate(true, function(err){
          assert.ifError(err);
        });

        Animal.path('ferret').doValidate(false, function(err){
          assert.ok(err instanceof Error);
        });
      });

      it('multiple', function(done) {
        var executed = 0;

        function validator (value, fn) {
          setTimeout(function(){
            executed++;
            fn(value === true);
            if (2 === executed) done();
          }, 5);
        };

        var Animal = new Schema({
          ferret: {
            type: Boolean,
            validate: [
              {
                'validator': validator,
                'msg': 'validator1'
              },
              {
                'validator': validator,
                'msg': 'validator2'
              }
            ]
          }
        });

        Animal.path('ferret').doValidate(true, function(err){
          assert.ifError(err);
        });
      });

      it('scope', function(done){
        var called = false;
        function validator (value, fn) {
          assert.equal('b', this.a);

          setTimeout(function(){
            called = true;
            fn(true);
          }, 5);
        };

        var Animal = new Schema({
            ferret: { type: Boolean, validate: validator }
        });

        Animal.path('ferret').doValidate(true, function(err){
          assert.ifError(err);
          assert.equal(true, called);
          done();
        }, { a: 'b' });
      })
    })

    describe('messages', function(){
      describe('are customizable', function(){
        it('within schema definitions', function(done){
          var schema = new Schema({
              name: { type: String, enum: ['one', 'two'] }
            , myenum: { type: String, enum: { values: ['x'], message: 'enum validator failed for path: {PATH} with {VALUE}' }}
            , requiredString1: { type: String, required: true }
            , requiredString2: { type: String, required: 'oops, {PATH} is missing. {TYPE}' }
            , matchString0: { type: String, match: /bryancranston/ }
            , matchString1: { type: String, match: [/bryancranston/, 'invalid string for {PATH} with value: {VALUE}'] }
            , numMin0: { type: Number, min: 10 }
            , numMin1: { type: Number, min: [10, 'hey, {PATH} is too small']}
            , numMax0: { type: Number, max: 20 }
            , numMax1: { type: Number, max: [20, 'hey, {PATH} ({VALUE}) is greater than {MAX}'] }
          });

          var A = mongoose.model('schema-validation-messages-'+random(), schema);

          var a = new A;
          a.validate(function (err) {
            assert.equal('Path `requiredString1` is required.', err.errors.requiredString1);
            assert.equal('oops, requiredString2 is missing. required', err.errors.requiredString2);

            a.requiredString1 = a.requiredString2 = 'hi';
            a.name = 'three';
            a.myenum = 'y';
            a.matchString0 = a.matchString1 = 'no match';
            a.numMin0 = a.numMin1 = 2;
            a.numMax0 = a.numMax1 = 30;

            a.validate(function (err) {
              assert.equal('`three` is not a valid enum value for path `name`.', err.errors.name);
              assert.equal('enum validator failed for path: myenum with y', err.errors.myenum);
              assert.equal('Path `matchString0` is invalid (no match).', err.errors.matchString0);
              assert.equal('invalid string for matchString1 with value: no match', err.errors.matchString1);
              assert.equal('Path `numMin0` (2) is less than minimum allowed value (10).', String(err.errors.numMin0));
              assert.equal('hey, numMin1 is too small', String(err.errors.numMin1));
              assert.equal('Path `numMax0` (30) is more than maximum allowed value (20).', err.errors.numMax0);
              assert.equal('hey, numMax1 (30) is greater than 20', String(err.errors.numMax1));

              a.name = 'one';
              a.myenum = 'x';
              a.requiredString1 = 'fixed';
              a.matchString1 = a.matchString0 = 'bryancranston is an actor';
              a.numMin0 = a.numMax0 = a.numMin1 = a.numMax1 = 15;
              a.validate(done);
            });
          })
        })

        it('for custom validators', function(done){
          function validate () {
            return false;
          }
          var validator = [validate, '{PATH} failed validation ({VALUE})'];

          var schema = new Schema({ x: { type: [], validate: validator }});
          var M = mongoose.model('custom-validator-'+random(), schema);

          var m = new M({ x: [3,4,5,6] });

          m.validate(function (err) {
            assert.equal('x failed validation (3,4,5,6)', String(err.errors.x));
            assert.equal('user defined', err.errors.x.type);
            done();
          })
        })
      })
    })

    describe('types', function(){
      describe('are customizable', function(){
        it('for single custom validators', function(done){
          function validate () {
            return false;
          }
          var validator = [validate, '{PATH} failed validation ({VALUE})', 'customType'];

          var schema = new Schema({ x: { type: [], validate: validator }});
          var M = mongoose.model('custom-validator-'+random(), schema);

          var m = new M({ x: [3,4,5,6] });

          m.validate(function (err) {
            assert.equal('x failed validation (3,4,5,6)', String(err.errors.x));
            assert.equal('customType', err.errors.x.type);
            done();
          })
        })

        it('for many custom validators', function(done){
          function validate () {
            return false;
          }
          var validator = [
              { validator: validate, msg: '{PATH} failed validation ({VALUE})', type: 'customType'}
          ]
          var schema = new Schema({ x: { type: [], validate: validator }});
          var M = mongoose.model('custom-validator-'+random(), schema);

          var m = new M({ x: [3,4,5,6] });

          m.validate(function (err) {
            assert.equal('x failed validation (3,4,5,6)', String(err.errors.x));
            assert.equal('customType', err.errors.x.type);
            done();
          })
        })
      })
    })
  });
});
