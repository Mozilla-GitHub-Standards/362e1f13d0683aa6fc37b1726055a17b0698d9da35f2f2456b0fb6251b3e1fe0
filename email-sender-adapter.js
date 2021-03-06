const nodemailer = require('nodemailer');

const {
  Adapter,
  Database,
  Device,
} = require('gateway-addon');

const config = {
  email: null,
  password: null,
  host: 'smtp.gmail.com',
  port: 465,
};

function createTransport() {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: true,
    requireTLS: true,
    auth: {
      user: config.email,
      pass: config.password,
    },
  });
}

function getMailOptions() {
  return {
    from: config.email,
    to: config.email,
    subject: '',
    text: '',
  };
}

function sendEmail(to, subject, body) {
  const transport = createTransport();
  return new Promise(function(resolve, reject) {
    transport.sendMail(Object.assign(getMailOptions(), {
      to: to,
      subject: subject,
      text: body,
    }), function(error, response) {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

const emailSenderThing = {
  type: 'thing',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': [],
  name: 'Email Sender',
  properties: [],
  actions: [
    {
      name: 'sendNotification',
      metadata: {
        label: 'Send Notification',
        description: 'Send a notification to yourself',
        input: {},
      },
    },
    {
      name: 'sendSimple',
      metadata: {
        label: 'Send Simple Email',
        description: 'Send email to yourself with only a subject',
        input: {
          type: 'object',
          properties: {
            subject: {
              type: 'string',
            },
          },
        },
      },
    },
    {
      name: 'send',
      metadata: {
        label: 'Send Email',
        description: 'Send email specifying all details',
        input: {
          type: 'object',
          required: [
            'to',
          ],
          properties: {
            to: {
              type: 'string',
            },
            subject: {
              type: 'string',
            },
            body: {
              type: 'string',
            },
          },
        },
      },
    },
  ],
  events: [],
};

/**
 * An email sending device
 */
class EmailSenderDevice extends Device {
  /**
   * @param {EmailSenderAdapter} adapter
   * @param {String} id - A globally unique identifier
   * @param {Object} template - the virtual thing to represent
   */
  constructor(adapter, id, template) {
    super(adapter, id);

    this.name = template.name;

    this.type = template.type;
    this['@context'] = template['@context'];
    this['@type'] = template['@type'];

    this.pinRequired = false;
    this.pinPattern = false;

    for (const action of template.actions) {
      this.addAction(action.name, action.metadata);
    }

    for (const event of template.events) {
      this.addEvent(event.name, event.metadata);
    }

    this.adapter.handleDeviceAdded(this);
  }

  async performAction(action) {
    console.log(`Performing action "${action.name}" with input:`, action.input);

    action.start();

    if (action.name === 'send') {
      await sendEmail(action.input.to,
                      action.input.subject || '', action.input.body || '');
    } else if (action.name === 'sendSimple') {
      await sendEmail(config.email, action.input.subject, '');
    } else if (action.name === 'sendNotification') {
      await sendEmail(config.email, 'Notification from Things Gateway', '');
    }

    action.finish();
  }
}

/**
 * Email Sender adapter
 * Instantiates one email sender device
 */
class EmailSenderAdapter extends Adapter {
  constructor(adapterManager, manifestName) {
    super(adapterManager, 'email-sender', manifestName);

    adapterManager.addAdapter(this);
    this.addAllThings();
  }

  startPairing() {
    this.addAllThings();
  }

  async loadConfig() {
    const db = new Database(this.packageName);
    await db.open();
    const dbConfig = await db.loadConfig();
    Object.assign(config, dbConfig);
  }

  addAllThings() {
    this.loadConfig().catch(function(err) {
      console.warn('Error updating config', err);
    });

    if (!this.devices['email-sender-0']) {
      new EmailSenderDevice(this, 'email-sender-0', emailSenderThing);
    }
  }
}

module.exports = EmailSenderAdapter;

