var instance_skel = require('../../instance_skel');
var tcp           = require('../../tcp');

var debug;
var log;

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);
	
	// export actions
	self.actions(); 
	
	// presets
	// self.init_presets();

	return self;
}

instance.prototype.updateConfig = function (config) {
	var self = this;
	// self.init_presets();

	if (self.socket !== undefined) {
		self.socket.destroy();
		delete self.socket;
	}

	self.config = config;
	self.init_tcp();
	
};

instance.prototype.init = function () {
	var self = this;

	debug = self.debug;
	log = self.log;
	
	// self.init_presets();
	self.init_tcp();

};

instance.prototype.init_tcp = function() {
	var self = this;

	if (self.socket !== undefined) {
		self.socket.destroy();
		delete self.socket;
	}

	self.status(self.STATE_WARNING, 'Connecting');

	if (self.config.host) {
		self.socket = new tcp(self.config.host, self.config.port);

		self.socket.on('status_change', function (status, message) {
			self.status(status, message);
		});

		self.socket.on('error', function (err) {
			debug("Network error", err);
			self.status(self.STATE_ERROR, err);
			self.log('error',"Network error: " + err.message);
		});

		self.socket.on('connect', function () {
			self.status(self.STATE_OK);
			debug("Connected");
		})

		self.socket.on('data', function (data) {});
	}
};

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;
	return [
		{
			type: 'text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'This module is for NEXO NXAMP amplifiers'
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Device IP',
			width: 6,
			regex: self.REGEX_IP
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Control port',
			width: 6,
			default: '49280',
			regex: self.REGEX_PORT
		}
	]
};

// When module gets deleted
instance.prototype.destroy = function () {
	var self = this;

	if (self.socket !== undefined) {
		self.socket.destroy();
	}

	debug("destroy", self.id);;
};

instance.prototype.init_presets = function () {
	var self = this;
	var presets = [];
	
	self.setPresetDefinitions(presets);
}

instance.prototype.actions = function (system) {
	var self = this;

	self.setActions({
		'power': {
			label: 'Power Control',
			options: [
				{
					type: 'dropdown',
					label: 'Power',
					id: 'power',
					default: '0',
					choices: [
						{ id: '1', label: 'On'}, 
						{ id: '0', label: 'Off'}
					]
				}
			]
		},
		'overMute': {
			label: 'Overmute',
			options: [
				{
					type: 'dropdown',
					label: 'Overmute',
					id: 'overmute',
					default: '0',
					choices: [
						{ id: '1', label: 'On'}, 
						{ id: '0', label: 'Off'}
					]
				}
			]
		},
		'channelMute': {
			label: 'Channel Mute',
			options: [
				{
					type: 'number',
					label: 'Channel',
					id: 'channelMute',
					min: 1,
					max: 4,
					default: 1
				},			
				{
					type: 'dropdown',
					label: 'Mute',
					id: 'muteState',
					default: '0',
					choices: [
						{ id: '1', label: 'On'}, 
						{ id: '0', label: 'Off'}
					]
				}				
			]
		},
	});
};

instance.prototype.action = function (action) {
	var self = this;
	const opt = action.options;
	console.log('action: ' + action.action);
	
	switch (action.action) {
		
		case 'power': {
			var powerCmd = 'set AMP:Power 0 0 ' + opt.power;
			console.log(powerCmd);
			self.log('debug',powerCmd)
			self.sendCmd(powerCmd);
			break;		
		}
		case 'overMute': {
			var overmuteCmd = 'set AMP:Overmute 0 0 ' + opt.overmute;
			console.log('debug',overmuteCmd);
			self.sendCmd(overmuteCmd);
			break;	
		}	
		case 'channelMute': {
			var muteCmd = 'set AMP:Ch/Mute ' + (opt.channelMute - 1) + ' 0 ' + Number(opt.muteState);
			console.log(muteCmd);
			self.log('debug',muteCmd);
			self.sendCmd(muteCmd);
			break;	
		}
		default:
			break;
	}

};

instance.prototype.sendCmd = function(cmdStr) {
	var self = this;
	var cmd;
	var end;

	cmd = unescape(cmdStr);
	end = '\n';
	
	console.log(cmd);

	/* 
	 * create a binary buffer pre-encoded 'latin1' (8bit no change bytes)
	 * sending a string assumes 'utf8' encoding 
	 * which then escapes character values over 0x7F
	 * and destroys the 'binary' content
	 */
	var sendBuf = Buffer.from(cmd + end, 'latin1');
	
	console.log(sendBuf);

	if (sendBuf != '') {
		// self.log('info','sending ',sendBuf,"to",self.config.host);

		if (self.socket !== undefined && self.socket.connected) {
			self.socket.send(sendBuf);
		}
		else {
			self.log('error','Socket not connected :(');
		}
	}
}

instance_skel.extendedBy(instance);
exports = module.exports = instance;