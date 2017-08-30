import chai from 'chai'

let expect = chai.expect
import config from '../config'
import $ from '../src'

let service = $(config)
let router = service.router()

let log = (err, doc) => {
  err && console.error(err.stack)
}

describe('service', function () {

})
