/*global QUnit*/

sap.ui.define([
	"spoolsassetdisposaltask/controller/GenericTask.controller"
], function (Controller) {
	"use strict";

	QUnit.module("GenericTask Controller");

	QUnit.test("I should test the GenericTask controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
