import Dataset from '../src/dataset';

import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { Server, PageRequest } from './test-server';

describe("Dataset", function() {
  describe("initializing a new dataset", function() {
    it("cannot be instantiated without pageSize", function() {
      var err = "";
      try {
        new Dataset();
      } catch(e) { err = e; }
      expect(err).to.match(/without pageSize/);
    });

    it("cannot be instantiated without fetch()", function () {
      var err = "";
      try {
        new Dataset({
          pageSize: 1
        });
      } catch(e) { err = e; }
      expect(err).to.match(/without fetch/);
    });

    it("cannot be instantiated with unloadHorizon less than loadHorizon", function () {
      var err = "";
      try {
        new Dataset({
          pageSize: 1,
          fetch: () => {},
          loadHorizon: 5,
          unloadHorizon: 1
        });
      } catch(e) { err = e; }
      expect(err).to.match(/unloadHorizon less than loadHorizon/);
    });

    it("requires pagesize and fetch function", function() {
      var err = "";
      try {
        new Dataset({
          pageSize: 1,
          fetch: () => {}
        });
      } catch(e) { err = e; }
      expect(err).to.equal('');
    });
  });

  describe("observing pages", function() {
    let dataset, requests, server, store, unfetched;

    let fetch = (pageOffset, pageSize, stats) => {
      return server.request(pageOffset, pageSize, stats);
    };

    let unfetch =  (records, pageOffset)=> {
      unfetched = requests[pageOffset];
    };

    let observe =  (_pages) => {
      Object.assign(dataset, { store: _pages });
    };

    beforeEach(function() {
      store = {};
      unfetched = {};

      server = new Server();
      requests = server.requests;

      dataset = new Dataset({
        pageSize: 10,
        fetch, unfetch, observe
      });
    });

    it("creates an observable dataset", function() {
      let records = dataset.store.slice();
      expect(dataset.store.length).to.equal(0);
      expect(records.length).to.equal(0);
    });

    it("does not fetch a page", function() {
      expect(requests.length).to.equal(0);
    });

    describe("setting the read offset", function() {
      beforeEach(function() {
        dataset.setReadOffset(0);
      });

      it("requests pages", function() {
        expect(requests.length).to.equal(1);
      });

      it("sets the length and readOffset on dataset", function() {
        expect(dataset.store.readOffset).to.equal(0);
        expect(dataset.store.length).to.equal(10);
      });

      describe("advancing the read offset", function() {
        beforeEach(function() {
          dataset.setReadOffset(35);
        });

        it("requests additional pages", function() {
          expect(requests.length).to.equal(5);
          expect(dataset.store.length).to.equal(50);
        });
      });

      describe("resolving a page", function() {
        beforeEach(function() {
          let page = dataset.store.requested[0];
          return server.resolve(page.offset);
        });

        it("resolves the page", function() {
          let records = dataset.store.slice();
          expect(dataset.store.resolved.length).to.equal(1);
          expect(dataset.store.length).to.equal(10);
          expect(records.length).to.equal(10);

          let name = records[0].content.name;
          expect(name).to.equal('Record 0');
        });
      });

      describe("rejecting a page", function() {
        beforeEach(function(done) {
          let page = dataset.store.requested[0];
          let finish = ()=> done();
          return server.reject(page.offset).then(finish).catch(finish);
        });

        it("rejects the page", function() {
          expect(dataset.store.rejected.length).to.equal(1);
          expect(dataset.store.totalPages).to.equal(1);
        });

        it("does not have any records", function() {
          let records = dataset.store.slice();
          expect(dataset.store.length).to.equal(0);
          expect(records.length).to.equal(0);
        });
      });

      describe("decrementing the readOffset below 0", function() {
        beforeEach(function() {
          dataset.setReadOffset(-5);
        });
        it("sets the readOffset to 0", function () {
          expect(dataset.store.readOffset).to.equal(0);
        });
      });
    });

    describe("with less than one page loadHorizon", function() {
      beforeEach(function() {
        dataset = new Dataset({
          pageSize: 10,
          loadHorizon: 5,
          fetch, unfetch, observe
        });
        dataset.setReadOffset(0);
      });

      it("requests one page of records", function() {
        expect(dataset.store.length).to.equal(10);
      });
    });

    describe("with less than two pages loadHorizon", function() {
      beforeEach(function() {
        dataset = new Dataset({
          pageSize: 10,
          loadHorizon: 15,
          fetch, unfetch, observe
        });
        dataset.setReadOffset(0);
      });

      it("requests two pages of records", function() {
        expect(dataset.store.length).to.equal(20);
      });

      describe("resolving all requests", function() {
        beforeEach(function() {
          return server.resolveAll();
        });
        it("has two resolved pages", function() {
          const record = dataset.store._getRecord(0);
          expect(record.isResolved).to.be.true;
        });
      });

      describe("rejecting all requests", function() {
        beforeEach(function(done) {
          server.requests.forEach((request) => request.reject());
          let finish = ()=> done();
          return Promise.all(server.requests).then(finish).catch(finish);
        });
        it("has two rejected pages", function() {
          expect(dataset.store.rejected.length).to.equal(2);
          expect(dataset.store.length).to.equal(0);
        });
      });
    });
  });

  describe.skip("setting readOffset to zero", function () {
    beforeEach(function() {
      this.dataset = new Dataset();
      this.initialReadOffset = 0;
    });
    describe("with less than two pages loadHorizon", function() {
      beforeEach(function() {
        this.options.loadHorizon = 15;
        this.dataset.init(this.options);
        this.dataset.setReadOffset(this.initialReadOffset);
      });


      describe.skip("incrementing the readOffset to the next page", function() {
        beforeEach(function() {
          this.dataset.setReadOffset(10);
          return this.server.resolveAll();
        });
        it("has three resolved pages", function() {
          expect(this.recordAtPage(0).isResolved).to.be.true;
          expect(this.recordAtPage(1).isResolved).to.be.true;
          expect(this.recordAtPage(2).isResolved).to.be.true;
        });
      });
      describe.skip("decrementing the readOffset below 0", function() {
        beforeEach(function() {
          this.dataset.setReadOffset(-5);
          return this.server.resolveAll();
        });
        it("sets the readOffset to 0", function () {
          expect(dataset.readOffset).to.equal(0);
        });
      });
    });
  });
});



// TODO: These are the remaining tests
// To migrate to the new dataset-tests
describe.skip("Dataset", function() {

  describe("loading records", function() {
    beforeEach(function() {
      this.recordAtPage = function(pageIndex) {
        if(pageIndex < this.dataset.pages.length) {
          return this.dataset.pages.get(pageIndex).records[0];
        } else {
          return undefined;
        }
      };
      this.totalPages = 10;
      this.recordsPerPage = 10;
      this.server = new Server();

      this.options = {
        pageSize: this.recordsPerPage,
        fetch: (pageOffset, pageSize, stats) => {
          return this.server.request(pageOffset, pageSize, stats);
        },
        unfetch: (records, pageOffset)=> {
          return this.server.remove(records, pageOffset);
        },
        observe: (dataset) => {
          this.dataset = dataset;
        }
      };
    });

    describe("setting readOffset to zero", function () {
      beforeEach(function() {
        this.dataset = new Dataset();
        this.initialReadOffset = 0;
      });
      describe("with less than one page loadHorizon", function() {
        beforeEach(function() {
          this.options.loadHorizon = 5;
          this.dataset.init(this.options);
          this.dataset.setReadOffset(this.initialReadOffset);
        });
        it("requests one page of records", function() {
          expect(this.dataset.length).to.equal(10);
        });
      });
      describe("with less than two pages loadHorizon", function() {
        beforeEach(function() {
          this.options.loadHorizon = 15;
          this.dataset.init(this.options);
          this.dataset.setReadOffset(this.initialReadOffset);
        });
        it("requests two pages of records", function() {
          expect(this.dataset.length).to.equal(20);
        });
        describe("resolving all requests", function() {
          beforeEach(function() {
            return this.server.resolveAll();
          });
          it("has two resolved pages", function() {
            expect(this.recordAtPage(0).isResolved).to.be.true;
            // expect(this.recordAtPage(1).isResolved).to.be.true;
            // expect(this.recordAtPage(2)).to.be.empty;
          });
        });
        describe.skip("rejecting all requests", function() {
          beforeEach(function(done) {
            this.server.requests.forEach((request) => request.reject());
            let finish = ()=> done();
            return Promise.all(this.server.requests).then(finish).catch(finish);
          });
          it("has two rejected pages", function() {
            expect(this.recordAtPage(0).isRejected).to.be.true;
            expect(this.recordAtPage(1).isRejected).to.be.true;
            expect(this.recordAtPage(2)).to.be.empty;
          });
        });
        describe.skip("incrementing the readOffset to the next page", function() {
          beforeEach(function() {
            this.dataset.setReadOffset(10);
            return this.server.resolveAll();
          });
          it("has three resolved pages", function() {
            expect(this.recordAtPage(0).isResolved).to.be.true;
            expect(this.recordAtPage(1).isResolved).to.be.true;
            expect(this.recordAtPage(2).isResolved).to.be.true;
          });
        });
        describe.skip("decrementing the readOffset below 0", function() {
          beforeEach(function() {
            this.dataset.setReadOffset(-5);
            return this.server.resolveAll();
          });
          it("sets the readOffset to 0", function () {
            expect(this.dataset.readOffset).to.equal(0);
          });
        });
      });
    });

    describe.skip("setting readOffset to a large offset", function() {
      beforeEach(function() {
        this.initialReadOffset = 50;
      });
      describe("with less than one page loadHorizon", function() {
        beforeEach(function() {
          this.options.loadHorizon = 5;
          this.dataset = new Dataset(this.options);
          this.dataset.setReadOffset(this.initialReadOffset);
        });
        it("initializes six pages of records", function() {
          expect(this.dataset.length).to.equal(60);
        });
        it("has two pending pages", function() {
          expect(this.recordAtPage(3).isRequested).to.be.false;
          expect(this.recordAtPage(4).isPending).to.be.true;
          expect(this.recordAtPage(5).isPending).to.be.true;
          expect(this.recordAtPage(6)).to.be.empty;
        });
      });
      describe("with less than two page loadHorizon and unloadHorizon", function() {
        beforeEach(function() {
          this.options.loadHorizon = 15;
          this.options.unloadHorizon = 15;
          this.dataset = new Dataset(this.options);
          this.dataset.setReadOffset(this.initialReadOffset);
        });
        it("initializes seven pages of records", function() {
          expect(this.dataset.length).to.equal(70);
        });
        it("has four pending pages", function() {
          expect(this.recordAtPage(2).isRequested).to.be.false;
          expect(this.recordAtPage(3).isPending).to.be.true;
          expect(this.recordAtPage(4).isPending).to.be.true;
          expect(this.recordAtPage(5).isPending).to.be.true;
          expect(this.recordAtPage(6).isPending).to.be.true;
          expect(this.recordAtPage(7)).to.be.empty;
        });
        describe("incrementing the read offset to the next page before resolving any pages", function() {
          beforeEach(function() {
            this.dataset.setReadOffset(60);
          });
          it("unloads a page", function() {
            expect(this.recordAtPage(3).isRequested).to.be.false;
          });
          it("has four pending pages", function() {
            expect(this.recordAtPage(4).isPending).to.be.true;
            expect(this.recordAtPage(5).isPending).to.be.true;
            expect(this.recordAtPage(6).isPending).to.be.true;
            expect(this.recordAtPage(7).isPending).to.be.true;
            expect(this.recordAtPage(8)).to.be.empty;
          });
        });

        describe("resolving all requests", function() {
          beforeEach(function() {
            return this.server.resolveAll();
          });
          it("has four resolved pages", function() {
            expect(this.recordAtPage(2).isRequested).to.be.false;
            expect(this.recordAtPage(3).isResolved).to.be.true;
            expect(this.recordAtPage(4).isResolved).to.be.true;
            expect(this.recordAtPage(5).isResolved).to.be.true;
            expect(this.recordAtPage(6).isResolved).to.be.true;
          });
          describe("incrementing the readOffset to the next page", function() {
            beforeEach(function() {
              this.prevRequest = this.server.requests[3];
              this.dataset.setReadOffset(60);
              return this.server.resolveAll();
            });
            it("unloads a page", function() {
              expect(this.recordAtPage(3).isRequested).to.be.false;
            });
            it("unfetches the unloaded page", function() {
              var unfetchedRequest = this.server.requests[3];
              expect(unfetchedRequest).to.be.empty;
              expect(this.prevRequest).to.not.be.empty;
            });
            it("has four resolved pages", function() {
              expect(this.recordAtPage(4).isResolved).to.be.true;
              expect(this.recordAtPage(5).isResolved).to.be.true;
              expect(this.recordAtPage(6).isResolved).to.be.true;
              expect(this.recordAtPage(7).isResolved).to.be.true;
              expect(this.recordAtPage(8)).to.be.empty;
            });
          });
          describe("decrementing the readOffset to the prev page", function() {
            beforeEach(function() {
              this.dataset.setReadOffset(40);
              return this.server.resolveAll();
            });
            it("unloads a page", function() {
              expect(this.recordAtPage(6).isRequested).to.be.false;
            });

            it("has four resolved pages", function() {
              expect(this.recordAtPage(2).isResolved).to.be.true;
              expect(this.recordAtPage(3).isResolved).to.be.true;
              expect(this.recordAtPage(4).isResolved).to.be.true;
              expect(this.recordAtPage(5).isResolved).to.be.true;
            });
          });
        });
      });
    });

    describe.skip("fetching filtered records", function() {
      beforeEach(function() {
        this.server = new Server();
        this.options = {
          pageSize: 10,
          unloadHorizon: 10,
          fetch: (pageOffset, pageSize, stats) => {
            stats.totalPages = 5;
            return this.server.request(pageOffset, pageSize, stats);
          },
          filter: (record) => {
            // Filter only Odd Indexed Records
            return record && (parseInt(record.name.substr(7)) % 2);
          },
          observe: (state) => {
            this.dataset = state;
          }
        };
        this.dataset = new Dataset(this.options);
        this.dataset.setReadOffset(0);
      });

      it("fetches a page of records", function() {
        expect(this.server.requests.length).to.equal(1);
        expect(this.server.requests[0]).to.be.instanceOf(PageRequest);
        expect(this.dataset.length).to.equal(10);
      });
      it("returns a pending state", function() {
        expect(this.dataset.isPending).to.be.true;
      });
      it("fetches a set of empty Pending records", function() {
        let record = this.dataset.pages.records.get(0);
        expect(record.index).to.equal(0);
        expect(record.isPending).to.be.true;
        expect(record.content).to.equal(null);
        expect(record.page.offset).to.equal(0);
      });
      describe("resolving all fetch request", function() {
        beforeEach(function() {
          return this.server.resolveAll();
        });
        it("sets total pages", function() {
          expect(this.dataset.stats.totalPages).to.equal(5);
        });
        it("filters records on the first page", function () {
          expect(this.dataset.length).to.equal(45);
          const record = this.dataset.get(0);
          expect(record.isResolved).to.be.true;
          expect(record.content.name).to.equal("Record 1");
        });
        describe("incrementing the readOffset ahead two pages", function() {
          beforeEach(function() {
            this.dataset.setReadOffset(20);
            return this.server.resolveAll();
          });
          it("has two resolved pages", function() {
            expect(this.recordAtPage(0).isResolved).to.be.false;
            expect(this.recordAtPage(1).isResolved).to.be.true;
            expect(this.recordAtPage(2).isResolved).to.be.true;
            expect(this.recordAtPage(3).isResolved).to.be.false;
            expect(this.recordAtPage(4).isResolved).to.be.false;
            expect(this.recordAtPage(5)).to.be.empty;
          });
          it("filters two pages of records", function () {
            const pageSize = 10;
            const filteredRecordPerPage = 5;
            const unfilteredLength = this.dataset.pages.length * pageSize;
            const filteredLength = unfilteredLength - (2 * filteredRecordPerPage);
            expect(this.dataset.length).to.equal(filteredLength);

          });
          it("filters records on the second and third page", function () {
            expect(this.recordAtPage(1).content.name).to.equal("Record 11");
            expect(this.recordAtPage(2).content.name).to.equal("Record 21");
            const record = this.dataset.get(18);
            expect(record.content.name).to.equal("Record 27");
            const outOfBoundsRecord = this.dataset.get(40);
            expect(outOfBoundsRecord).to.equal(null);
          });
        });
        describe("mutating records", function() {
          beforeEach(function() {
            let record = this.dataset.get(0);
            record.content.name = "Record 100";
          });

          describe("without refiltering the dataset", function() {
            it("mutates the record", function() {
              const record = this.dataset.get(0);
              expect(record.content.name).to.equal("Record 100");
            });
            it("does not filter out the record", function () {
              expect(this.dataset.length).to.equal(45);
            });
          });

          describe("with refiltering the dataset", function() {
            beforeEach(function() {
              this.dataset.refilter();
            });

            it("filters out the record", function () {
              expect(this.dataset.length).to.equal(44);
            });

            it("find a new record", function() {
              const record = this.dataset.get(0);
              expect(record.content.name).to.equal("Record 3");
            });
          });
          describe("with reloading the dataset", function() {
            beforeEach(function() {
              return this.dataset.reload();
            });

            it("reloads the state", function () {
              expect(this.dataset.isPending).to.be.true;
            });

            it("maintains the total number of records", function () {
              expect(this.dataset.length).to.equal(50);
            });

            it("loses the mutated record", function () {
              const record = this.dataset.get(0);
              expect(record.content).to.be.equal(null);
            });
          });
          describe("with resetting the dataset", function() {
            beforeEach(function() {
              return this.dataset.reset();
            });

            it("resets the state", function () {
              expect(this.dataset.isPending).to.be.true;
            });

            it("resets the total number of records", function () {
              expect(this.dataset.length).to.equal(10);
            });

            it("loses the mutated record", function () {
              const record = this.dataset.get(0);
              expect(record.content).to.be.equal(null);
            });
          });
        });
      });

    });


    describe.skip("Statistics ", function() {
      beforeEach(function() {
        this.server = new Server();
        this.numFetchedPages = function() {
          return this.server.requests.reduce(function(num, request) {
            return (request instanceof PageRequest) ? num + 1 : num;
          }, 0);
        };
      });

      describe("when fetch() returns totalPages", function() {
        beforeEach(function() {
          this.totalPages = 10;
          this.options = {
            pageSize: 10,
            fetch: (pageOffset, pageSize, stats) => {
              stats.totalPages = 10;
              return this.server.request(pageOffset, pageSize, stats);
            },
            unfetch: (records, pageOffset)=> {
              return this.server.remove(records, pageOffset);
            },
            observe: (state) => {
              this.dataset = state;
            }
          };
          this.dataset = new Dataset(this.options);
          this.dataset.setReadOffset(0);
        });

        it("makes one request", function() {
          expect(this.numFetchedPages()).to.equal(1);
        });

        describe("resolving the request with totalPages stats", function() {
          beforeEach(function() {
            return this.server.resolveAll();
          });

          it("sets total pages", function() {
            expect(this.dataset.stats.totalPages).to.equal(10);
            expect(this.dataset.length).to.equal(100);
          });

          describe("Setting readOffset out of bounds", function() {
            beforeEach(function() {
              this.prevRequestCount = this.server.requests.length;
            });
            describe("where the minimum loadHorizon is less than the dataset length", function() {
              beforeEach(function() {
                let minLoadHorizon = this.dataset.length - 1;
                this.dataset.setReadOffset(minLoadHorizon + this.dataset.loadHorizon);
              });
              it("makes one additional request", function() {
                expect(this.numFetchedPages()).to.equal(this.prevRequestCount + 1);
              });
              it("requests the last page", function() {
                expect(this.recordAtPage(9).isRequested).to.be.true;
              });
              it("does not have a record at the readOffset", function() {
                let record = this.dataset.pages.records.get(100);
                expect(record).to.equal(null);
              });
              it("is in a pending state", function() {
                expect(this.dataset.isPending).to.be.true;
              });
            });
            describe("where the minimum loadHorizon is greater than or equal to the dataset length", function() {
              beforeEach(function() {
                let minLoadHorizon = this.dataset.length;
                this.dataset.setReadOffset(minLoadHorizon + this.dataset.loadHorizon);
              });

              it("does not make any additional request", function() {
                expect(this.numFetchedPages()).to.equal(this.prevRequestCount);
                expect(this.dataset.length).to.equal(100);
              });
              it("sets the readOffset at the out of bounds index", function() {
                expect(this.dataset.readOffset).to.equal(110);
              });
              it("is not in a pending state", function() {
                expect(this.dataset.isPending).to.be.false;
              });
            });
          });
        });

        describe("rejecting the request with totalPages stats", function() {
          beforeEach(function(done) {
            let finish = ()=> done();
            return this.server.requests[0].reject().then(finish).catch(finish);
          });

          it("sets the total pages", function() {
            expect(this.dataset.stats.totalPages).to.equal(10);
            expect(this.dataset.length).to.equal(100);
          });
        });
      });
    });
  });
});
