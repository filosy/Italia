// Copyright [2016] [Banana.ch SA - Lugano Switzerland]
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// @api = 1.0
// @id = ch.banana.script.invoicedata.2017.js
// @description = Dati delle fatture emesse e ricevute (file xml)
// @doctype = *;110
// @encoding = utf-8
// @exportfilename = IT99999999999_DF_00001
// @exportfiletype = csv
// @includejs = ch.banana.script.invoicedata.2017.createinstance.js
// @includejs = ch.banana.script.italianvatreport.2017.xml.js
// @inputdatasource = none
// @pubdate = 2017-04-20
// @publisher = Banana.ch SA
// @task = export.file
// @timeout = -1

function exec(inData) {

  if (!Banana.document)
    return "@Cancel";

  var param = initParam();
  var savedParam = Banana.document.scriptReadSettings();
  if (savedParam.length > 0) {
    param = JSON.parse(savedParam);
  }
  param = verifyParam(param);
  
  // Ask period
  var selPeriod = Banana.Ui.getPeriod("Periodo", Banana.document.startPeriod(), Banana.document.endPeriod(), param.repStartDate, param.repEndDate, true);
  if (!selPeriod)
    return "@Cancel";

  if (selPeriod.selectionChecked) {
    param.repStartDate = selPeriod.selectionStartDate;
    param.repEndDate = selPeriod.selectionEndDate;
  }
  else {
    param.repStartDate = selPeriod.startDate;
    param.repEndDate = selPeriod.endDate;
  }

  var paramToString = JSON.stringify(param);
  var value = Banana.document.scriptSaveSettings(paramToString);
  
  return loadData(param);

  var output = createInstance(param)

  if (output != "@Cancel") {
    var report = Banana.Report.newReport("Dati delle fatture emesse e ricevute");
    var stylesheet = Banana.Report.newStyleSheet();
    printVatReport1(report, stylesheet, param);
    Banana.Report.preview(report, stylesheet);
  }

  return output;

}

function initParam()
{
  var param = {};
  param.repStartDate = '';
  param.repEndDate = '';
  if (Banana.document) {
    param.repStartDate = Banana.document.startPeriod();
    param.repEndDate = Banana.document.endPeriod();
  }
  param.schemaRefs = init_schemarefs();
  param.namespaces = init_namespaces();
  return param;
}

function init_namespaces()
{
  var ns = [
    {
      'namespace' : 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2',
      'prefix' : 'xmlns:ns2',
    },
  ];
  return ns;
}
function init_schemarefs()
{
  var schemaRefs = [
    'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/DatiFattura_v2.0.xsd',
  ];
  return schemaRefs;
};

function loadData(param)
{
  var journal = Banana.document.journal(
    Banana.document.ORIGINTYPE_CURRENT, Banana.document.ACCOUNTTYPE_NORMAL);
  var filteredRows = journal.findRows(loadData_filterTransactions);

  if (!journal || !filteredRows)
    return false;
  
  var periodStart = Banana.Converter.stringToDate(param.repStartDate);
  var periodEnd = Banana.Converter.stringToDate(param.repEndDate);
  var tColumnNames = journal.columnNames;
  param.journal = {};
  param.journal.rows = [];
  var jsonLine = {};
  var value = "";

  for (var i = 0; i < filteredRows.length; i++) {
    //Check period
    var validPeriod = false;
    value = filteredRows[i].value("JDate");
    var currentDate = Banana.Converter.stringToDate(value, "YYYY-MM-DD");
    if (currentDate >= periodStart && currentDate <= periodEnd)
      validPeriod = true;
    if (!validPeriod) {
      continue;
     }

    //add data
    for (var j = 0; j < tColumnNames.length; j++) {
      var columnName = tColumnNames[j];
      value = filteredRows[i].value(columnName);
      jsonLine[columnName] = value;
    }
    param.journal.rows.push(jsonLine);
    jsonLine = {};
    value = "";
  }
  
  //debug
  var line = [];
  var transactions = [];
  for (var i = 0; i < param.journal.rows.length; i++) {
    var jsonObj = param.journal.rows[i];
    for (var key in jsonObj) {
      line.push(jsonObj[key]);
    }
    transactions.push(line);
    line = [];
  }
  line = [];
  var header = [];
  for (var i = 0; i < tColumnNames.length; i++) {
    var columnName = tColumnNames[i];
    line.push(columnName);
  }
  header.push(line);
  return tableToCsv(header.concat(transactions));
  
}

function loadData_filterTransactions(row, index, table) {

  //only normal transaction with vat
  //OperationType_None = 0, OperationType_Opening = 1, OperationType_CarryForward = 2,
  //OperationType_Transaction = 3, OperationType_Closure = 4, OperationType_Total = 6
  var operationType = row.value("JOperationType");
  if (operationType && operationType != Banana.document.OPERATIONTYPE_TRANSACTION)
    return false;

  var docType = row.value("JInvoiceDocType");
  if (docType == "10" || docType == "20")
    return true;
    
  return false;
}

function printVatReport1(report, stylesheet, param) {

  // Styles
  stylesheet.addStyle("phead", "font-size: 12px, font-weight: bold; margin-bottom: 1em");
  stylesheet.addStyle("thead", "font-weight: bold");
  stylesheet.addStyle("td", "padding-right: 1em");
  stylesheet.addStyle(".amount", "text-align: right");
  stylesheet.addStyle(".period", "font-size: 10px; padding-top: 1em;padding-bottom: 1em;");
  stylesheet.addStyle(".vatNumber", "font-size: 10px");
  stylesheet.addStyle(".warning", "color: red;font-size:8px;");

  //Print table
  var table = report.addTable("table1");

  // Print header
  var headerRow = table.getHeader().addRow();
  headerRow.addCell("");

  // Print data
  var row = table.addRow();
  row.addCell("");

}

function tableToCsv(table) {
    var result = "";
    for (var i = 0; i < table.length; i++) {
        var values = table[i];
        for (var j = 0; values && j < values.length; j++) {
            if (j > 0)
                result += ";";
            var value = values[j];
            result += value;
        }
        result += "\r\n";
    }
    return result;
}

function verifyParam(param) {
   if (!param.repStartDate)
     param.repStartDate = '';
   if (!param.repEndDate)
     param.repEndDate = '';
   return param;
}