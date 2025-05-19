sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/GroupHeaderListItem",
  "sap/m/plugins/UploadSetwithTable",
  "sap/ui/core/Item"
],
  /**
   * @param {typeof sap.ui.core.mvc.Controller} Controller
   */
  function (Controller, GroupHeaderListItem, UploadSetwithTable, Item) {
    "use strict";

    return Controller.extend("spoolsassetdisposaltask.controller.GenericTask", {
      onInit: function () {
        let path1 = this.getOwnerComponent().getManifestEntry("/sap.cloud/service").replaceAll(".", "");
        let path2 = this.getOwnerComponent().getManifestEntry("/sap.app/id").replaceAll(".", "")
        this.fullPath = `/${path1}.${path2}/`;

        if (!this.getOwnerComponent().loadedConext) {
          let requestId = "d3340187-0be9-4f32-ab21-02b667326500"
          this.getView().bindElement({ path: `/RequestDetails(ID=${requestId})` });
          return;
        }
        this.getOwnerComponent().loadedConext.then(function () {
          let context = this.getOwnerComponent().getContext();
          let requestId = context.requestId;
          if (context.canVoid) {
            this.getOwnerComponent().d();
          }

          this.getView().bindElement({ path: `/RequestDetails(ID=${requestId})` });

          // const bookBinding = this.getView().getModel().bindContext(`/Header(ID=${objectId})`, null, {
          //   $expand: { "assetDetails": { $select: ["*"], $expand: { "OS": { $select: ["*"] }, "manufacturer": { $select: ["*"] } } } }
          // });
          // bookBinding.requestObject().then(function (data) {
          //   let ControlData = this.getView().getModel("controlsModel").getData();

          //   ControlData.objectId.value = data.objectId;
          //   ControlData.date.value = data.date;
          //   ControlData.reqType_id.value = data.reqType_id;

          //   for (let i in ControlData.assetDetails) {
          //     ControlData.assetDetails[i].value = data.assetDetails[i];
          //   }
          //   // ControlData.assetDetails.assetCategory_id.value = data.assetDetails.assetCategory_id;
          //   // ControlData.assetDetails.manufacturer_id.value = data.assetDetails.manufacturer_id;
          //   // ControlData.assetDetails.OS_id.value = data.assetDetails.OS_id;
          //   // ControlData.assetDetails.ram.value = data.assetDetails.ram;
          //   // ControlData.assetDetails.productprice.value = data.assetDetails.productprice;
          //   // ControlData.assetDetails.mfgPartNum.value = data.assetDetails.mfgPartNum;

          //   this.getView().getModel("controlsModel").setData(ControlData);
          // }.bind(this));

        }.bind(this));

      },
      addAuditTrailDymmy: function () {
        this.getOwnerComponent().updateAuditTrial();
      },
      approve: function () {
        this.getOwnerComponent().approvalConfirmation("Approve", function () { this.getOwnerComponent().completeTask(false, "approve") }.bind(this));
      },
      reject: function () {
        this.getOwnerComponent().approvalConfirmation("Reject", function () { this.getOwnerComponent().completeTask(false, "reject") }.bind(this));
      },
      getTaskType: function (oContext) {
        return oContext.getProperty('taskType');
      },
      getGroupHeader: function (oGroup) {
        return new GroupHeaderListItem({
          title: oGroup.key
        });
      },
      uploadFile: async function (uploadInfo) {
        const uploadSetItem = uploadInfo.oItem,
          uploadSetTable = uploadInfo.oSource,
          itemBinding = this.getView().byId("table-uploadSet").getBinding("items"),
          data = {
            filename: uploadSetItem.getFileName()
          };
        let createdItem = itemBinding.create(data, true);
        await createdItem.created();
        // let canonicalPath = createdItem.getCanonicalPath();
        const ID = createdItem.getProperty("ID");

        const uploadPath = `${this.fullPath}odata/v4/asset-disposal-task-ui/AttachmentUpload(${ID})/content`;

        this.setHeaderFields(uploadSetTable);
        uploadSetItem.setUploadUrl(uploadPath);
        return await new Promise((resolve, reject) => {
          resolve(uploadSetItem);
        });
      },
      addHeader: function (fileUploader, name, value) {

        const header = new Item({
          key: name,
          text: value
        });
        fileUploader.addHeaderField(header);
      },
      setHeaderFields: function (fileUploader) {
        fileUploader.removeAllHeaderFields();
        const token = fileUploader.getModel().getHttpHeaders()?.["X-CSRF-Token"];

        if (token) {
          this.addHeader(fileUploader, "x-csrf-token", token);
        }

        this.addHeader(fileUploader, "Accept", "application/json");
      },
      onPluginActivated: function (oEvent) {
        this.oUploadPluginInstance = oEvent.getParameter("oPlugin");
      },
      getIconSrc: function (mediaType) {
        return UploadSetwithTable.getIconForFileType(mediaType, "");
      },
      getURL: function (up__ID, ID) {
        const path = `${this.fullPath}odata/v4/asset-disposal-task-ui/RequestDetails(ID=${up__ID})/attachments(up__ID=${up__ID},ID=${ID})/content`;
        return path;
      },

    });
  });
