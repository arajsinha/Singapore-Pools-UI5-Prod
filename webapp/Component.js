sap.ui.define(
  [
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "spoolsassetdisposaltask/model/models",
    "sap/m/Dialog",
    "sap/m/TextArea",
    "sap/m/Button",
    "sap/m/MessageBox"
  ],
  function (UIComponent, Device, models, Dialog, TextArea, Button, MessageBox) {
    "use strict";

    return UIComponent.extend(
      "spoolsassetdisposaltask.Component",
      {
        metadata: {
          manifest: "json",
        },
        approvalDialog: null,

        /**
         * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
         * @public
         * @override
         */
        init: async function () {
          // call the base component's init function
          UIComponent.prototype.init.apply(this, arguments);

          // enable routing
          this.getRouter().initialize();

          // set the device model
          this.setModel(models.createDeviceModel(), "device");

          this.setModel(new sap.ui.model.json.JSONModel({ "comment": "", "witness": "" }), "approvalModel");

          if (!this.getComponentData()?.startupParameters?.taskModel) {
            return;
          }

          await this.setTaskModels();
          const rejectOutcomeId = "reject";
          this.getInboxAPI().addAction(
            {
              action: rejectOutcomeId,
              label: "Reject",
              type: "reject",
            },
            function () {
              this.approvalConfirmation("Reject", function () { this.completeTask(false, rejectOutcomeId) }.bind(this));
            }.bind(this),
            this
          );
          const approveOutcomeId = "approve";
          this.getInboxAPI().addAction(
            {
              action: approveOutcomeId,
              label: "Approve",
              type: "accept",
            },
            function () {
              // Validate
              let context = this.getContext();
              const approvalData = this.getModel("approvalModel").getData();
              if (context.taskType == "Witness Selection") {
                if (approvalData.witness) {
                  this.approvalConfirmation("Approve", function () { this.completeTask(true, approveOutcomeId) }.bind(this));
                } else {
                  MessageBox.error(
                    "Please select a witness", {
                    title: "Error",
                    actions: [MessageBox.Action.OK],
                    emphasizedAction: MessageBox.Action.OK
                  }
                  );
                }
              } else {
                this.approvalConfirmation("Approve", function () { this.completeTask(true, approveOutcomeId) }.bind(this));
              }
            }.bind(this),
            this
          );
        },

        setTaskModels: async function () {
          // set the task model
          var startupParameters = this.getComponentData().startupParameters;
          this.setModel(startupParameters.taskModel, "task");

          // set the task context model
          var taskContextModel = new sap.ui.model.json.JSONModel(
            this._getTaskInstancesBaseURL() + "/context"
          );
          this.setModel(taskContextModel, "context");

          // parse Date objects and set in own model
          this.loadedConext = taskContextModel.loadData(this._getTaskInstancesBaseURL() + "/context");

          // set the task context model
          var taskContext = new sap.ui.model.json.JSONModel(
            this._getTaskInstancesBaseURL()
          );
          this.setModel(taskContext, "taskContext");
          taskContext.loadData(this._getTaskInstancesBaseURL());

        },

        _getTaskInstancesBaseURL: function () {
          return (
            this._getWorkflowRuntimeBaseURL() +
            "/task-instances/" +
            this.getTaskInstanceID()
          );
        },

        _getWorkflowRuntimeBaseURL: function () {
          var ui5CloudService = this.getManifestEntry("/sap.cloud/service").replaceAll(".", "")
          var ui5ApplicationName = this.getManifestEntry("/sap.app/id").replaceAll(".", "");
          var appPath = `${ui5CloudService}.${ui5ApplicationName}`;
          return `/${appPath}/api/public/workflow/rest/v1`
        },

        _getPath: function () {
          // return "";
          var ui5CloudService = this.getManifestEntry("/sap.cloud/service").replaceAll(".", "")
          var ui5ApplicationName = this.getManifestEntry("/sap.app/id").replaceAll(".", "");
          var appPath = `${ui5CloudService}.${ui5ApplicationName}`;
          return `/${appPath}/`
        },

        getTaskInstanceID: function () {
          return this.getModel("task").getData().InstanceID;
        },

        getInboxAPI: function () {
          var startupParameters = this.getComponentData().startupParameters;
          return startupParameters.inboxAPI;
        },

        completeTask: function (approvalStatus, outcomeId) {
          this.getModel("context").setProperty("/approved", approvalStatus);
          let promise = this.updateAuditTrial(outcomeId);
          promise.then(function () { this._patchTaskInstance(outcomeId) }.bind(this));
        },

        voidTask: function () {
          let context = this.getContext();
          let requestId = context.requestId;
          const path = this._getPath();
          return new Promise(function (resolve, reject) {
            $.ajax({
              url: `${path}odata/v4/asset-disposal/RequestDetails(ID=${requestId}, IsActiveEntity=true)/AssetDisposal.void`,
              type: 'POST',
              headers: {
                "X-CSRF-Token": this._fetchTokenAssetDisposalSrv()
              },
              data: JSON.stringify({
              }),
              contentType: 'application/json',
              success: function (response) {
                console.log('Update successful:', response);
                this._refreshTaskList();
                resolve();
              }.bind(this),
              error: function (xhr, status, error) {
                console.error('Update failed:', error);
              }.bind(this)
            });
          }.bind(this));
        },

        _patchTaskInstance: function (outcomeId) {
          const context = this.getModel("context").getData();
          const approvalData = this.getModel("approvalModel").getData();
          const path = this._getPath();
          let approver = "";
          jQuery.ajax({
            url: `${path}user-api/currentUser`,
            method: "GET",
            contentType: "application/json",
            async: false,
            success(result, xhr, data) {
              approver = result.email;
            }
          });

          var data = {
            status: "COMPLETED",
            context: { ...context, comment: approvalData.comment || '', approver: approver, witness: approvalData.witness },
            decision: outcomeId
          };

          jQuery.ajax({
            url: `${this._getTaskInstancesBaseURL()}`,
            method: "PATCH",
            contentType: "application/json",
            async: true,
            data: JSON.stringify(data),
            headers: {
              "X-CSRF-Token": this._fetchToken(),
            },
          }).done(() => {
            this._refreshTaskList();
          })
        },

        _fetchToken: function () {
          var fetchedToken;

          jQuery.ajax({
            url: this._getWorkflowRuntimeBaseURL() + "/xsrf-token",
            method: "GET",
            async: false,
            headers: {
              "X-CSRF-Token": "Fetch",
            },
            success(result, xhr, data) {
              fetchedToken = data.getResponseHeader("X-CSRF-Token");
            },
          });
          return fetchedToken;
        },

        _refreshTaskList: function () {
          this.getInboxAPI().updateTask("NA", this.getTaskInstanceID());
        },

        addVoidOption: function () {
          this.getInboxAPI().addAction(
            {
              action: "void",
              label: "Void",
              type: "reject",
            },
            function () {
              this.approvalConfirmation("Void", function () { this.completeTask(false, "void") }.bind(this));
            }.bind(this),
            this
          );
        },

        updateAuditTrial: function (outcomeId) {
          let context = this.getContext();
          let requestId = context.requestId;
          let hasVoid = false;
          if (context.canVoid) {
            hasVoid = true;
          }
          let data = this.getModel("approvalModel").getData();
          const path = this._getPath();
          let status;
          switch (outcomeId) {
            case "approve":
              status = "Approved";
              break;
            case "reject":
              status = "Rejected";
              break;
            case "void":
              status = "Void";
              break;
            default:
              break;
          }
          return new Promise(function (resolve, reject) {
            $.ajax({
              url: `${path}odata/v4/asset-disposal-task-ui/RequestDetails(ID=${requestId})/AssetDisposalTaskUI.addAuditTrial`,
              // url: `/odata/v4/asset-disposal-task-ui/RequestDetails(ID=${requestId})/AssetDisposalTaskUI.addAuditTrial`,
              type: 'POST',
              headers: {
                "X-CSRF-Token": this._fetchTokenAssetSrv()
              },
              data: JSON.stringify({
                "requestId": requestId,
                "taskID": context.taskData.InstanceID,
                "taskName": context.taskData.TaskDefinitionName,
                "taskTitle": context.taskData.TaskTitle,
                "workflowId": context.taskContext.workflowInstanceId,
                "taskType": context.taskType,
                "comment": data.comment,
                "status": status,
                "hasVoid": hasVoid
              }),
              contentType: 'application/json',
              success: function (response) {
                console.log('Update successful:', response);
                resolve();
              }.bind(this),
              error: function (xhr, status, error) {
                console.error('Update failed:', error);
              }.bind(this)
            });
          }.bind(this));
        },

        getContext: function () {
          let context = {};
          let taskContext = {};
          if (this.getModel("context")) {
            let taskData = this.getModel("task").getData();
            context = this.getModel("context").getData();
            taskContext = this.getModel("taskContext").getData();
            context.taskData = taskData;
            context.taskContext = taskContext;
          } else {
            context.requestId = "d3340187-0be9-4f32-ab21-02b667326500";//testing purpose
            context.taskData = {};
            context.taskData.InstanceID = "f66208be-4d06-4f5b-8f03-636b9586d7a9";
            context.taskData.TaskDefinitionName = "Verified By Approval";
            context.taskData.TaskTitle = "Please approve the Task";
            context.taskContext = {};
            context.taskContext.workflowId = "f66208be-4d06-4f5b-8f03-636b9586d7a9";
            context.taskType = "Verified by";
          }
          return context;
        },

        _fetchTokenAssetSrv: function () {
          var fetchedToken;
          const path = this._getPath();

          jQuery.ajax({
            url: `${path}odata/v4/asset-disposal-task-ui/`,
            method: "GET",
            async: false,
            headers: {
              "X-CSRF-Token": "Fetch",
            },
            success(result, xhr, data) {
              fetchedToken = data.getResponseHeader("X-CSRF-Token");
            },
          });
          return fetchedToken;
        },


        _fetchTokenAssetDisposalSrv: function () {
          var fetchedToken;
          const path = this._getPath();

          jQuery.ajax({
            url: `${path}odata/v4/asset-disposal/`,
            method: "GET",
            async: false,
            headers: {
              "X-CSRF-Token": "Fetch",
            },
            success(result, xhr, data) {
              fetchedToken = data.getResponseHeader("X-CSRF-Token");
            },
          });
          return fetchedToken;
        },

        approvalConfirmation: function (type, action) {
          this.getModel("approvalModel").setProperty("/type", type);
          this.approvalAction = action;
          if (!this.approvalDialog) {
            this.approvalDialog = new Dialog({
              title: "Would you like to " + "{approvalModel>/type}" + " ?",
              content: [
                new TextArea({
                  value: "{approvalModel>/comment}",
                  width: "100%",
                  placeholder: "Enter your comment here...",
                  growing: true
                })
              ],
              buttons: [
                new Button({
                  text: "Ok",
                  press: function () {
                    let data = this.getModel("approvalModel").getData();
                    if (data.comment) {
                      this.approvalAction();
                      this.approvalDialog.close();
                    } else {
                      MessageBox.error(
                        "Please enter the comment", {
                        title: "Error",
                        actions: [MessageBox.Action.OK],
                        emphasizedAction: MessageBox.Action.OK
                      }
                      );
                    }
                  }.bind(this)
                }),
                new Button({
                  text: "Cancel",
                  press: function () {
                    this.approvalDialog.close();
                  }.bind(this)
                })
              ]
            }).addStyleClass("sapUiResponsiveContentPadding");
            this.approvalDialog.setModel(this.getModel("approvalModel"), "approvalModel")
          }
          this.getModel("approvalModel").setProperty("/comment", "");
          this.approvalDialog.open();
        }
      }
    );
  }
);
