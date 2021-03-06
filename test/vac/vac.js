var cfg = {
  wsdl_file : 'EVacSyncService_SPClient.wsdl',
  service_url_path : '/services/ESyncNotifySP',
  service_port : 8007,
  psp_url : 'http://127.0.0.1/admin/if_vac_h'
}

var soap = require('node-soap-ly')
  , path = require('path')
  , http = require('http')
  , QueryString = require('querystring')
  , Request = require('request')
  , moment = require('moment')
  , fs = require('fs')
  , reqSeq = 0
  , defLog = false
  ;

var SoapServices = {
  'ESyncNotifySPServiceService' : {
    'ESyncNotifySP' : {
      'eOrderRelationUpdateNotify' : function(args){
        var fiber = Fiber.current;
        var oraReqNV = args["eOrderRelationUpdateNotifyRequest"];
        /* example request data from EVAC
         <RecordSequenceID>12345678901</RecordSequenceID>
         <UserIdType>1</UserIdType>
         * <UserId>8612312345678</UserId> => gcust_t.billnum
         <ServiceType>ServiceType</ServiceType>
         <SpId>SpId</SpId>
         <ProductId>ProductId</ProductId>
         * <UpdateType>1</UpdateType> ~=> gcust_t.vac_sts
         <UpdateTime>20120228163657</UpdateTime>
         <UpdateDesc>UpdateDesc</UpdateDesc>
         <LinkID>LinkID</LinkID>
         <Content>Content</Content>
         * <EffectiveDate>20120228163657</EffectiveDate> => gcust_t.sdate
         * <ExpireDate>20120228163657</ExpireDate> => gcust_t.edate
         <Time_Stamp>20120228163657</Time_Stamp>
         <EncodeStr>EncodeStr</EncodeStr>
         <SubInfo>gid=tjuc</SubInfo> =>gcust_t.gid
         */
        oraReqNV.SubInfo.split(',').forEach(function(line){
          if (!line) return;
          var nv = line.split('=');
          if (!nv[0]) return;
          oraReqNV[nv[0]] = nv[1];
        });
        Request({
            uri : cfg.psp_url + '.e',
            method : 'post',
            headers : {
              'Content-Type' : "application/x-www-form-urlencoded"
            },
            body : QueryString.stringify(oraReqNV)
          },
          function(error, response, body){
            if (!error && response.statusCode === 200) {
              fiber.run({
                'eOrderRelationUpdateNotifyResponse' : {
                  'RecordSequenceID' : oraReqNV.RecordSequenceID,
                  'ResultCode' : body
                }
              });
            } else {
              fiber.run({
                'eOrderRelationUpdateNotifyResponse' : {
                  'RecordSequenceID' : oraReqNV.RecordSequenceID,
                  'ResultCode' : 1
                }
              });
            }
          });
        return yield();
      },
      'eMemOrderRelationUpdateNotify' : function(args){
        var fiber = Fiber.current;
        args = args["eMemOrderRelationUpdateNotifyRequest"];
        /* example request data from EVAC
         <RecordSequenceID>12345678902</RecordSequenceID>
         <UserIdType>1</UserIdType>
         <UserId>15620009233</UserId> * mobile
         <ServiceType>ServiceType</ServiceType>
         <SpId>SpId</SpId>
         <ProductId>ProductId</ProductId> *
         <UpdateType>1</UpdateType> *
         <UpdateTime>UpdateTime</UpdateTime>
         <UpdateDesc>UpdateDesc</UpdateDesc>
         <LinkID>LinkID</LinkID>
         <Content>Content</Content>
         <EffectiveDate>20120228163657</EffectiveDate> * stime
         <ExpireDate>20120228163657</ExpireDate> * etime
         <Time_Stamp>20120228163657</Time_Stamp>
         <EncodeStr>EncodeStr</EncodeStr>
         <EUserIdType>1</EUserIdType>
         <EUserId>8612312345678</EUserId> * billnum
         */
        var oraReqNV = {
          'billnum' : args.EUserId,
          'UpdateType' : args.UpdateType,
          'ProductId' : args.ProductId,
          'stime' : args.EffectiveDate,
          'etime' : args.ExpireDate,
          'mobile' : args.UserId.substr(-11)
        };
        Request({
            uri : cfg.psp_url + '.m',
            method : 'post',
            headers : {
              'Content-Type' : "application/x-www-form-urlencoded"
            },
            body : QueryString.stringify(oraReqNV)
          },
          function(error, response, body){
            if (!error && response.statusCode === 200) {
              fiber.run({
                'eMemOrderRelationUpdateNotifyResponse' : {
                  'RecordSequenceID' : args.RecordSequenceID,
                  'ResultCode' : body
                }
              });
            } else {
              fiber.run({
                'eMemOrderRelationUpdateNotifyResponse' : {
                  'RecordSequenceID' : args.RecordSequenceID,
                  'ResultCode' : 1
                }
              });
            }
          });
        return yield();
      }
    }
  }
}

var server = http.createServer(function(req, res){
  res.end("404: Not Found: " + request.url);
});
server.listen(cfg.service_port);
var wsdl_string = require('fs').readFileSync(path.resolve(cfg.wsdl_file), 'utf8');
var soap_server = soap.listen(server, cfg.service_url_path, SoapServices, wsdl_string);

soap_server.logger_req = function(xml, req, res){
  req.__time = moment().format('MMDD-HHmmss');
  var cip = req.connection.remoteAddress;
  var filename = 'logs/srv-' + req.__time + '-' + (++reqSeq) + '-' + cip + '-req.log.xml';
  var ws = fs.createWriteStream(filename);
  ws.write(xml);
  ws.end();
};
soap_server.logger_res = function(xml, req, res){
  var cip = req.connection.remoteAddress;
  var filename = 'logs/srv-' + req.__time + '-' + '-' + (++reqSeq) + '-' + cip + '-res.log.xml';
  var ws = fs.createWriteStream(filename);
  ws.write(xml);
  ws.end();
};

setTimeout(function(){
    if (!defLog) return;
    var def = soap_server.wsdl.definitions;
    var schema = def.schemas[Object.keys(def.schemas)[0]];
    var service = def.services[Object.keys(def.services)[0]];
    var binding = def.bindings[Object.keys(def.bindings)[0]];
    var portType = def.portTypes[Object.keys(def.portTypes)[0]];
    var binding_method = binding.methods[Object.keys(binding.methods)[0]];
    var portType_method = portType.methods[Object.keys(portType.methods)[0]];
    var input = portType_method.input;
    var type = schema.complexTypes[Object.keys(schema.complexTypes)[0]];
    console.log(def);
    console.log('\nschema=');
    console.log(schema);
    console.log('\nservice=');
    console.log(service);
    console.log('\nbinding=');
    console.log(binding);
    console.log('\nportType=');
    console.log(portType);
    console.log('\nbinding.method=');
    console.log(binding_method);
    console.log('\nportType.method=');
    console.log(portType_method);
    console.log('---');
    console.log(portType_method.description(def));
    console.log('\nportType.method.input=');
    console.log(input);
    console.log('\nportType.method.input.parts=');
    console.log(input.parts);
  },
  0);

var logSeq = 0;
function do_test(client){
  client.logger_req = function(xml){
    var time = moment().format('MMDD-HHmmss');
    var filename = 'logs/cli-' + time + '-' + (++logSeq) + '-req.log.xml';
    var ws = fs.createWriteStream(filename);
    ws.write(xml);
    ws.end();
  };
  client.logger_res = function(xml){
    var time = moment().format('MMDD-HHmmss');
    var filename = 'logs/cli-' + time + '-' + '-' + (++logSeq) + '-res.log.xml';
    var ws = fs.createWriteStream(filename);
    ws.write(xml);
    ws.end();
  };
  client.ESyncNotifySPServiceService.ESyncNotifySP.eOrderRelationUpdateNotify({
      "eOrderRelationUpdateNotifyRequest" : {
        "RecordSequenceID" : 12345678901,
        "UserIdType" : 1,
        "UserId" : "8612312345678",
        "ServiceType" : "ServiceType",
        "SpId" : "SpId",
        "ProductId" : "ProductId",
        "UpdateType" : 1,
        "UpdateTime" : "20120228163657",
        "UpdateDesc" : "UpdateDesc",
        "LinkID" : "LinkID",
        "Content" : "Content",
        "EffectiveDate" : "20120228163657",
        "ExpireDate" : "20120228163657",
        "Time_Stamp" : "20120228163657",
        "EncodeStr" : "EncodeStr",
        "SubInfo" : "gid=tjuc"
      }
    },
    function(err, result, body){
      if (err) {
        console.log(err);
        return;
      }
      console.log(result);
    });
  client.ESyncNotifySPServiceService.ESyncNotifySP.eMemOrderRelationUpdateNotify({
      "eMemOrderRelationUpdateNotifyRequest" : {
        "RecordSequenceID" : 12345678902,
        "UserIdType" : 1,
        "UserId" : "15620009233",
        "ServiceType" : "ServiceType",
        "SpId" : "SpId",
        "ProductId" : "ProductId",
        "UpdateType" : 1,
        "UpdateTime" : "UpdateTime",
        "UpdateDesc" : "UpdateDesc",
        "LinkID" : "LinkID",
        "Content" : "Content",
        "EffectiveDate" : "20120228163657",
        "ExpireDate" : "20120228163657",
        "Time_Stamp" : "20120228163657",
        "EncodeStr" : "EncodeStr",
        "EUserIdType" : 1,
        "EUserId" : "8612312345678"
      }
    },
    function(err, result){
      if (err) {
        console.log(err);
        return;
      }
      console.log(result);
    });
}


if (process.argv[2]) {
  switch (process.argv[2].toLowerCase()) {
    case 'log':
      defLog = true;
      break;
    case 'test':
      soap.createClient('http://127.0.0.1:' + cfg.service_port + cfg.service_url_path + '?wsdl',
        function(err, client){
          setTimeout(function(){
            console.log('-- in client ' + Object.keys(client.wsdl));
            do_test(client);
          }, 3);
        });
  }
} else {
  console.log("Usage: node vac.js [test|log]");
  console.log('test will make test requests;');
  console.log('log will log parsed wsdl definition parts;');
  console.log();
}


