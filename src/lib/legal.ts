// Public Terms of Service and Privacy Policy, rendered by src/components/LegalDocument.tsx.
// A section body is a list of blocks: a string is a paragraph, a string[] is a bulleted
// list, and { h } is a sub-heading.

export const LEGAL_ORG = "OpenAppHub";
export const LEGAL_APP = "OpenBoard";
export const LEGAL_EFFECTIVE = "November 6, 2026";
export const LEGAL_UPDATED = "November 6, 2026";
export const LEGAL_CONTACT = "legal@openapphub.org";
export const SUPPORT_CONTACT = "support@openapphub.org";

export type LegalBlock = string | string[] | { h: string };
export type LegalSection = { title: string; body: LegalBlock[] };
export type LegalDoc = { title: string; sections: LegalSection[] };

const ORG = LEGAL_ORG;
const APP = LEGAL_APP;

export const terms: LegalDoc = {
  title: "Terms of Service",
  sections: [
    {
      title: "Acceptance of Terms",
      body: [
        `These Terms of Service ("Terms") govern your access to and use of ${APP} ("Application" or "Service"), including its website, features, functionality, and related services.`,
        `The Application is operated by ${ORG} ("we," "us," or "our").`,
        "By creating an account, accessing, or using the Application, you acknowledge that you have read and agree to these Terms and the accompanying Privacy Policy.",
        "If you are accessing the Application on behalf of an organization, you represent that you are authorized to accept these Terms on behalf of that organization.",
        "If you do not agree to these Terms, you must discontinue use of the Application.",
      ],
    },
    {
      title: "Definitions",
      body: [
        [
          `Application or Service: ${APP} and all associated software, features, services, and functionality.`,
          "Operating Organization: The parent organization legally responsible for operating and maintaining the Application.",
          "Customer Organization: A nonprofit, club, board, association, or other organization that uses the Application to manage its operations.",
          "User: An individual authorized to access the Application.",
          "Organization Data: Information, records, documents, communications, membership information, meeting minutes, votes, and other content submitted to or maintained within the Application.",
          "User Content: Information and materials submitted, uploaded, created, or otherwise provided by a User.",
          "Personal Information: Information relating to an identified or identifiable individual.",
        ],
      ],
    },
    {
      title: "Description of Services",
      body: [
        `${APP} is designed to help organizations manage board operations, governance activities, meetings, documents, membership, voting, and related administrative functions.`,
        "The Application provides tools for organizations and their authorized users to create, maintain, and access organizational records.",
        "We may add, modify, improve, or discontinue features as necessary to maintain and develop the Service.",
        "We will make reasonable efforts to communicate material changes that substantially affect the availability or functionality of the Service.",
      ],
    },
    {
      title: "Accounts and Access",
      body: [
        "Users must provide accurate information when creating or maintaining an account.",
        "Users are responsible for maintaining the confidentiality of their login credentials and for activity conducted through their accounts.",
        "Users must promptly notify us if they believe their account has been compromised or accessed without authorization.",
        "Customer Organizations are responsible for determining which individuals are authorized to access their organizational information and for assigning appropriate permissions.",
        "We may restrict, suspend, or revoke access when reasonably necessary to protect the Application, its Users, Customer Organizations, or the security of information maintained within the Service.",
        "We reserve the right to verify account ownership and authorization when responding to access, modification, or deletion requests.",
      ],
    },
    {
      title: "Data Ownership and Custodianship",
      body: [
        `Customer Organizations and Users retain ownership of the information, records, documents, and other content they submit to or create within ${APP}, subject to any rights belonging to third parties.`,
        "The Operating Organization acts as a custodian of Customer Organization Data. We do not claim ownership of Customer Organization Data or User Content merely because it is stored, processed, or maintained within the Application.",
        "Our role is limited to providing the technical infrastructure and services necessary to store, maintain, process, secure, and make that information available to authorized Users.",
        "We do not acquire independent rights to exploit, commercialize, publish, sell, or otherwise use Customer Organization Data for purposes unrelated to providing the Service, except where authorized by the Customer Organization or permitted or required by applicable law.",
        "Users and Customer Organizations are responsible for ensuring that they have the necessary rights and permissions to submit information to the Application.",
        "Nothing in these Terms transfers intellectual property ownership in User Content or Organization Data to the Operating Organization.",
      ],
    },
    {
      title: "Limited License to Operate the Service",
      body: [
        `By submitting information to ${APP}, you grant the Operating Organization a limited, non-exclusive, non-transferable license to host, store, reproduce, transmit, display, and process that information solely as reasonably necessary to:`,
        [
          "Provide the features and functionality of the Application.",
          "Make information available to authorized Users within the appropriate organization.",
          "Maintain, troubleshoot, support, and secure the Application.",
          "Create and maintain backups and operational records as reasonably necessary.",
          "Comply with applicable legal obligations.",
        ],
        "This license terminates when the relevant information is deleted or the Service is discontinued, except to the extent that continued retention or processing is necessary or permitted under these Terms or applicable law.",
      ],
    },
    {
      title: "Acceptable Use",
      body: [
        "Users agree to use the Application only for lawful purposes and in accordance with these Terms.",
        "Users may not:",
        [
          "Use the Application to violate federal, state, or local laws or regulations.",
          "Attempt to gain unauthorized access to another User's account, organizational records, or restricted functionality.",
          "Interfere with the availability, integrity, or security of the Application.",
          "Upload malicious software, harmful code, or unauthorized content.",
          "Use the Application to harass, threaten, defraud, or otherwise harm another person.",
          "Attempt to circumvent authentication, authorization, or other security controls.",
          "Access, collect, or disclose another organization's information without authorization.",
          "Reverse engineer, exploit, or interfere with the Application except where such restrictions are prohibited by applicable law.",
        ],
      ],
    },
    {
      title: "Customer Organization Responsibilities",
      body: [
        "Customer Organizations are responsible for their internal governance, membership management, organizational decisions, and the accuracy of the information they maintain within the Application.",
        "Customer Organizations are responsible for determining who may access their records and for managing User permissions.",
        "Customer Organizations must ensure that information submitted to the Application is collected and processed in accordance with applicable law and their own organizational policies.",
        "The Operating Organization does not independently determine the validity of organizational decisions, elections, votes, meeting minutes, or governance procedures recorded within the Application.",
        "Customer Organizations remain responsible for maintaining any records they are independently required to retain under applicable law.",
      ],
    },
    {
      title: "Privacy and Data Handling",
      body: [
        `Your use of ${APP} is also governed by our Privacy Policy, which is incorporated into these Terms by reference.`,
        "We do not sell Customer Organization Data or Personal Information.",
        "We do not use Customer Organization Data or Personal Information for advertising, targeted marketing, or unrelated commercial purposes.",
        "We do not operate advertising networks within the Application or permit advertising providers to use Customer Organization Data for advertising purposes.",
        "Information is processed only as necessary to provide and maintain the Service, protect its security, support authorized Users, or comply with applicable law.",
        "Limited information may be processed by hosting, infrastructure, and other service providers acting on our behalf to operate the Application. Such processing is subject to appropriate contractual and operational safeguards.",
      ],
    },
    {
      title: "Third-Party Services",
      body: [
        "The Application may rely on third-party service providers for hosting, infrastructure, authentication, email delivery, storage, security, and other operational functions.",
        "These providers may process limited information as necessary to perform services on our behalf.",
        "We do not authorize these providers to independently sell Customer Organization Data or use it for their own advertising or marketing purposes.",
        "Third-party services that Users independently access or integrate with may be subject to separate terms and privacy policies.",
        "We are not responsible for the independent privacy or security practices of third-party services outside our control.",
      ],
    },
    {
      title: "Compliance with Applicable Law and Legal Requests",
      body: [
        "The Application is operated in accordance with applicable federal, state, and local laws and regulations.",
        "Nothing in these Terms or our Privacy Policy prevents or restricts the Operating Organization from complying with a valid legal obligation or lawful governmental request.",
        "We may preserve, access, use, or disclose information when reasonably necessary to:",
        [
          "Comply with applicable laws, regulations, and legally enforceable obligations.",
          "Respond to valid subpoenas, warrants, court orders, or other lawful governmental demands.",
          "Cooperate with lawful investigations or regulatory proceedings.",
          "Protect the rights, property, security, and safety of the Operating Organization, Customer Organizations, Users, or the public, to the extent permitted by applicable law.",
        ],
        "Where legally permitted, we will make reasonable efforts to limit disclosures to the information required by the applicable legal obligation.",
        "Where legally permitted and reasonably practicable, we may notify the affected Customer Organization of a legal request before disclosing information. We do not guarantee notification where prohibited by law or where notification would create an unacceptable legal or security risk.",
        "We will not voluntarily provide unrestricted access to Customer Organization Data merely because a governmental entity requests it. Requests will be evaluated in accordance with applicable law.",
      ],
    },
    {
      title: "Service Availability and Changes",
      body: [
        `We make reasonable efforts to maintain the availability and reliability of ${APP} but do not guarantee uninterrupted or error-free operation.`,
        "The Service may be temporarily unavailable due to maintenance, infrastructure failures, security incidents, third-party service disruptions, or circumstances beyond our reasonable control.",
        "We may modify, update, or discontinue portions of the Application as necessary for operational, technical, security, or legal reasons.",
        "We will make reasonable efforts to provide notice of material changes when practicable.",
      ],
    },
    {
      title: "Information Security",
      body: [
        "We implement reasonable administrative, technical, and organizational safeguards designed to protect information maintained within the Application.",
        "These safeguards are intended to prevent unauthorized access, alteration, disclosure, loss, or destruction of information.",
        "No electronic storage system, transmission method, or security measure can guarantee absolute security.",
        "Users and Customer Organizations are responsible for maintaining appropriate account security and protecting their own devices and credentials.",
        "We will address security incidents in accordance with applicable legal requirements and our operational security procedures.",
      ],
    },
    {
      title: "Suspension and Termination",
      body: [
        "Users may discontinue using the Application at any time.",
        "Customer Organizations may request closure of their organizational accounts in accordance with the Application's available account-management procedures.",
        "We may suspend or terminate access when reasonably necessary due to violations of these Terms, security concerns, unlawful activity, legal obligations, or discontinuation of the Service.",
        "Upon termination, access to organizational information may be restricted and information may be scheduled for deletion in accordance with our Privacy Policy and applicable retention requirements.",
        "Termination does not eliminate obligations that arose before termination or obligations that survive under applicable law.",
      ],
    },
    {
      title: "Data Deletion and Retention",
      body: [
        "Customer Organizations and authorized Users may request deletion of information associated with their accounts, subject to their permissions and applicable law.",
        "When an account is closed or deletion is requested, we will take reasonable steps to delete the associated information from active production systems in accordance with our established deletion procedures.",
        "Certain information may be retained when required by law, necessary to resolve disputes, protect security, prevent fraud, or establish or defend legal claims.",
        "Information contained in backups may remain temporarily until those backups are overwritten or expire through the normal backup-retention process.",
        "Information retained for legal or operational reasons will not be used for unrelated commercial purposes.",
        "Where information cannot immediately be deleted due to legal requirements or technical limitations, we will limit its continued processing to the applicable retention purpose.",
      ],
    },
    {
      title: "Disclaimer of Warranties",
      body: [
        'TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE APPLICATION IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS.',
        "We make no guarantees that the Application will always be available, uninterrupted, error-free, or compatible with every device or environment.",
        "We do not guarantee that information entered by Users or Customer Organizations is accurate, complete, or legally sufficient.",
        "The Application is an administrative and organizational tool. It does not provide legal, financial, accounting, tax, or professional advice.",
        "Nothing in these Terms excludes warranties or rights that cannot legally be excluded under applicable law.",
      ],
    },
    {
      title: "Limitation of Liability",
      body: [
        "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE OPERATING ORGANIZATION SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES ARISING FROM OR RELATED TO THE USE OF THE APPLICATION.",
        "This includes, where legally permitted, loss of profits, business interruption, loss of goodwill, loss of anticipated savings, or loss of data.",
        "The Operating Organization shall not be responsible for decisions made by Customer Organizations or Users based on information maintained within the Application.",
        "Nothing in these Terms limits liability that cannot legally be limited or excluded under applicable law.",
      ],
    },
    {
      title: "Indemnification",
      body: [
        "To the extent permitted by applicable law, Users and Customer Organizations agree to be responsible for claims arising from their unlawful use of the Application, unauthorized submission of information, infringement of third-party rights, or material violation of these Terms.",
        "Nothing in this section requires a User to indemnify the Operating Organization for the Operating Organization's own unlawful conduct or liability that cannot legally be transferred.",
      ],
    },
    {
      title: "Changes to These Terms",
      body: [
        "We may update these Terms from time to time to reflect changes in the Application, our operational practices, or applicable law.",
        "The current version will be made available within the Application, together with its effective or last-updated date.",
        "Where required by applicable law, we will provide notice of material changes or obtain renewed consent.",
        "Continued use of the Application after updated Terms become effective constitutes acceptance where permitted by applicable law.",
      ],
    },
    {
      title: "Governing Law and Jurisdiction",
      body: [
        "These Terms shall be governed by the laws of the State of Oklahoma and applicable federal law, without regard to conflict-of-law principles, subject to any mandatory laws that apply to a particular User or Customer Organization.",
        "Any dispute arising from these Terms shall be brought before a court of competent jurisdiction, subject to applicable law and any non-waivable legal rights.",
        "Nothing in this section limits rights or remedies that cannot legally be waived.",
      ],
    },
    {
      title: "Severability",
      body: [
        "If any provision of these Terms is determined to be invalid, unlawful, or unenforceable, the remaining provisions shall continue in effect to the fullest extent permitted by law.",
        "Any invalid or unenforceable provision shall be interpreted or modified to the minimum extent necessary to make it enforceable, where legally permitted.",
      ],
    },
    {
      title: "Contact Information",
      body: [
        `${APP} is operated by ${ORG}.`,
        [`Legal inquiries: ${LEGAL_CONTACT}`, `Technical support: ${SUPPORT_CONTACT}`],
        "Please include sufficient information to identify your organization and describe your inquiry.",
      ],
    },
  ],
};

export const privacy: LegalDoc = {
  title: "Privacy Policy",
  sections: [
    {
      title: "Introduction",
      body: [
        `${APP} is operated by ${ORG} ("we," "us," or "our").`,
        `We recognize that the information entrusted to ${APP} may include sensitive organizational records, personal information, membership details, meeting records, and internal communications.`,
        "We believe that the information maintained within the Application belongs to the individuals and organizations that provide it, subject to applicable third-party rights.",
        "Our role is to act as a custodian of that information and to provide the technology necessary to store, manage, and make it available to authorized Users.",
        "We do not sell personal information or organizational data. We do not use information for advertising, targeted marketing, or unrelated commercial purposes.",
        "This Privacy Policy describes our information-handling practices and the rights and responsibilities associated with using the Application.",
      ],
    },
    {
      title: "Scope and Roles",
      body: [
        `This Policy applies to individuals who access or use ${APP}, including representatives, officers, board members, employees, volunteers, and other authorized Users.`,
        "A Customer Organization generally determines what organizational information is submitted to the Application, who may access it, and how it is used for that organization's activities.",
        "Depending on the nature of the relationship and applicable law, the Customer Organization may act as the data controller or business responsible for the information, while the Operating Organization acts as a service provider, processor, or custodian.",
        "The Operating Organization may independently determine limited processing necessary to administer accounts, maintain security, operate the Service, and comply with legal obligations.",
        "Customer Organizations may maintain separate privacy policies or notices governing their own organizational activities. Users should consult their organization regarding questions about the collection or use of organizational information.",
      ],
    },
    {
      title: "Information We Collect",
      body: [
        "We collect and process only information that is provided to us or reasonably necessary to operate, secure, and maintain the Application.",
        "Depending on how the Application is used, information may include the following categories:",
        { h: "3.1 Account Information" },
        [
          "Name, email address, username, account identifiers, authentication information, and other details provided during registration or account management.",
          "Organization membership, role, permissions, and account status.",
        ],
        { h: "3.2 Organizational Information" },
        [
          "Organization names, contact information, membership records, board rosters, officer information, and organizational details.",
          "Meeting schedules, agendas, minutes, attendance records, resolutions, motions, votes, and governance documentation.",
          "Documents, files, communications, and other information submitted by authorized Users.",
        ],
        { h: "3.3 User-Provided Information" },
        [
          "Information entered into forms, submitted through application features, uploaded as documents, or otherwise provided by Users.",
          "Information about third parties that a Customer Organization or User chooses to submit to the Application.",
          "Users and Customer Organizations are responsible for ensuring that they have an appropriate legal basis and authorization to provide information about other individuals.",
        ],
        { h: "3.4 Technical and Security Information" },
        "Limited technical information may be processed automatically to operate and secure the Application.",
        "This may include IP addresses, browser type, device information, session identifiers, authentication events, timestamps, application errors, and security-related activity.",
        "Such information is used for authentication, troubleshooting, fraud prevention, security monitoring, and maintaining reliable service.",
        { h: "3.5 Support and Communications" },
        "Information provided when contacting technical support, reporting problems, submitting inquiries, or communicating with the Operating Organization.",
        "This may include your contact details, the contents of your communication, and relevant information necessary to investigate and resolve your inquiry.",
      ],
    },
    {
      title: "How We Use Information",
      body: [
        `We use information only for purposes reasonably related to providing, maintaining, securing, and supporting ${APP}.`,
        "These purposes include:",
        [
          "Creating and administering User accounts.",
          "Authenticating Users and enforcing access permissions.",
          "Storing and displaying organizational records and documents.",
          "Providing meeting, governance, membership, and voting functionality.",
          "Maintaining system availability and performance.",
          "Troubleshooting technical problems and responding to support requests.",
          "Protecting the Application against unauthorized access, misuse, and security threats.",
          "Maintaining backups and operational records.",
          "Complying with applicable federal, state, and local laws.",
        ],
        "We do not use Customer Organization Data or Personal Information for unrelated commercial purposes.",
      ],
    },
    {
      title: "No Sale, Marketing, or Advertising",
      body: [
        "We do not sell, rent, lease, license, or exchange Personal Information or Customer Organization Data for monetary or other valuable consideration.",
        "We do not sell user information to data brokers or advertising networks.",
        "We do not use Customer Organization Data or Personal Information to create advertising profiles, deliver targeted advertisements, or support third-party advertising campaigns.",
        `We do not display third-party advertisements within ${APP}.`,
        "We do not use information maintained within the Application for independent marketing, promotional campaigns, or unrelated commercial exploitation.",
        "We do not use organizational records or User Content to develop advertising products or marketing profiles.",
        "We may send communications necessary to operate the Service, including account verification, password recovery, security notifications, technical announcements, and legally required notices. These are operational communications, not marketing communications.",
        "We will not repurpose operational communications as a channel for unrelated promotional messaging.",
      ],
    },
    {
      title: "Service Providers and Third-Party Processing",
      body: [
        `We may use carefully selected third-party service providers to operate and maintain ${APP}.`,
        "These providers may include infrastructure hosting providers, database providers, authentication services, email delivery providers, storage providers, and security services.",
        "Such providers may process information only to the extent reasonably necessary to perform services on our behalf or as otherwise permitted by applicable law.",
        "We do not authorize service providers to sell Customer Organization Data or use it for their own independent advertising or marketing purposes.",
        "Where appropriate, we use contractual, technical, and organizational safeguards designed to protect information processed by these providers.",
        "We may update or replace service providers as operational needs change. Material changes to our information-processing practices will be reflected in this Policy where appropriate.",
        "A current list of relevant service providers and their processing purposes should be maintained by the Operating Organization and made available where required by applicable law or agreement.",
      ],
    },
    {
      title: "Cookies and Similar Technologies",
      body: [
        `${APP} may use cookies or similar technologies to provide a reliable and convenient user experience.`,
        "These technologies may be used for:",
        [
          "Maintaining authenticated sessions and keeping Users signed in.",
          "Remembering preferences and application settings.",
          "Maintaining security and preventing unauthorized access.",
          "Supporting essential application functionality.",
        ],
        "We do not use cookies for advertising, targeted advertising, cross-site advertising tracking, or the sale of Personal Information.",
        "We do not authorize advertising networks to place tracking cookies within the Application.",
        "Where applicable law requires consent for non-essential cookies or similar technologies, we will obtain that consent before using them.",
        "Users may be able to manage or disable cookies through their browser settings. Disabling certain cookies may affect the availability or functionality of some Application features.",
      ],
    },
    {
      title: "Access to Information",
      body: [
        "Access to organizational information is restricted according to the permissions and roles established within the Application.",
        "Customer Organizations are responsible for determining which Users may access their organizational information.",
        "The Operating Organization may access information when reasonably necessary to:",
        [
          "Provide technical support requested by an authorized User.",
          "Troubleshoot or resolve application issues.",
          "Maintain or restore system functionality.",
          "Investigate suspected unauthorized access, fraud, or security incidents.",
          "Perform necessary maintenance, backups, or system administration.",
          "Comply with applicable legal obligations.",
        ],
        "Access by personnel should be limited to individuals with an operational need and should be subject to appropriate administrative and technical safeguards.",
        "We do not routinely review or monitor organizational content for unrelated purposes.",
      ],
    },
    {
      title: "Legal Requirements and Government Requests",
      body: [
        "We operate in accordance with applicable federal, state, and local laws and regulations.",
        "We may preserve, access, process, or disclose information when required or authorized by applicable law.",
        "Circumstances may include:",
        [
          "Valid subpoenas and court orders.",
          "Search warrants and other legally enforceable demands.",
          "Regulatory requirements and lawful governmental investigations.",
          "Legal obligations to preserve or produce records.",
          "Other legally authorized requests or disclosures.",
        ],
        "We will not treat an informal request as automatically authorizing unrestricted access to Customer Organization Data.",
        "Where legally permitted, we will make reasonable efforts to verify the legal basis and scope of a request and limit any disclosure to the information reasonably required.",
        "Where legally permitted and reasonably practicable, we may notify the affected Customer Organization before disclosing information.",
        "We cannot guarantee notification where prohibited by law, restricted by a valid order, or where notification would create an unacceptable legal or security risk.",
        "Nothing in this Policy prevents us from complying with a lawful obligation or valid legal process.",
      ],
    },
    {
      title: "Information Security",
      body: [
        `We implement reasonable administrative, technical, and organizational safeguards designed to protect information maintained within ${APP}.`,
        "Depending on the relevant system and functionality, safeguards may include:",
        [
          "Authentication and authorization controls.",
          "Role-based access restrictions.",
          "Secure communication and data transmission.",
          "Database access controls.",
          "System monitoring and security logging.",
          "Backup and recovery procedures.",
          "Software maintenance and security updates.",
        ],
        "We periodically review our security practices and make improvements as appropriate.",
        "No security system or method of electronic transmission can guarantee absolute protection. We cannot guarantee that unauthorized access, data loss, or other security incidents will never occur.",
        "We will address security incidents in accordance with applicable law and our established incident-response procedures.",
      ],
    },
    {
      title: "Data Retention",
      body: [
        "We retain information only for as long as reasonably necessary to provide the Service, fulfill operational requirements, and comply with applicable legal obligations.",
        "Customer Organization Data is generally maintained while the applicable organization maintains an active account or otherwise requires access to the information.",
        "Certain technical, security, and operational records may be retained for limited periods after account closure where necessary for security, troubleshooting, fraud prevention, or legal compliance.",
        "Information may also be retained where required to establish, exercise, or defend legal claims or to satisfy applicable recordkeeping obligations.",
        "We do not retain information indefinitely for advertising, marketing, data brokerage, or unrelated commercial purposes.",
      ],
    },
    {
      title: "Account Closure and Data Deletion",
      body: [
        "We recognize that Customer Organizations and Users retain ownership of their information and should be able to discontinue using the Application without surrendering ownership of their records.",
        "Authorized Users and Customer Organizations may request the deletion of information associated with their accounts, subject to applicable permissions and legal requirements.",
        "Account closure or a valid deletion request will initiate the applicable deletion process.",
        "We will take reasonable steps to remove the requested information from active production systems in accordance with our established deletion procedures.",
        "Certain information may remain temporarily in backups, disaster-recovery systems, or other protected archival storage until those systems reach their normal expiration or replacement cycles.",
        "We may retain information where required by law or where reasonably necessary to address security matters, prevent fraud, resolve disputes, or establish or defend legal claims.",
        "Information retained under these exceptions will be restricted to the purpose requiring retention and will not be used for unrelated commercial purposes.",
        "Deletion requests may be subject to verification of identity, account ownership, and organizational authority.",
        "A User's request to delete their personal account does not necessarily authorize deletion of records belonging to the Customer Organization or other Users.",
        "Customer Organizations should maintain their own copies of records they are independently required to preserve.",
      ],
    },
    {
      title: "Privacy Rights and Requests",
      body: [
        "Depending on your location, the nature of the information, and applicable law, you may have rights concerning Personal Information maintained within the Application.",
        "These rights may include:",
        [
          "Requesting access to Personal Information.",
          "Requesting correction of inaccurate information.",
          "Requesting deletion of Personal Information.",
          "Requesting information about how Personal Information is processed or disclosed.",
          "Requesting a copy of certain information in a portable format.",
          "Objecting to or restricting certain processing activities where applicable law provides that right.",
          "Withdrawing consent where processing is based on consent.",
        ],
        "These rights may be subject to legal exceptions and limitations.",
        "Where a Customer Organization controls the relevant information, Users may need to direct their request to that organization. We will assist the organization as appropriate and as required by applicable law.",
        `Privacy requests may be submitted to ${LEGAL_CONTACT}.`,
        "We may request additional information reasonably necessary to verify the identity and authority of the person making a request.",
        "We will respond to valid requests within the timeframes required by applicable law.",
      ],
    },
    {
      title: "Children's Information",
      body: [
        `${APP} is designed primarily for organizational and administrative use.`,
        "The Application is not intentionally designed to collect Personal Information directly from children under the age of 13.",
        "Users and Customer Organizations are responsible for ensuring that information concerning minors is collected, submitted, and maintained in accordance with applicable law.",
        "Where information concerning a child is submitted without an appropriate legal basis or authorization, the affected organization or individual should contact us so that the matter can be reviewed and addressed.",
      ],
    },
    {
      title: "Data Location and Processing",
      body: [
        "Information may be processed or stored in the locations where the Operating Organization and its authorized service providers maintain infrastructure.",
        "The location of data storage and processing may depend on the hosting and infrastructure services used by the Application.",
        "Where information is transferred across state or national boundaries, we will take reasonable steps to comply with applicable legal requirements governing such transfers.",
        "The Operating Organization should maintain accurate information regarding hosting locations and relevant service providers.",
      ],
    },
    {
      title: "Security Incidents and Breach Notifications",
      body: [
        `If we become aware of a security incident involving information maintained within ${APP}, we will investigate and take reasonable steps to contain, mitigate, and address the incident.`,
        "Where applicable law requires notification of affected individuals, Customer Organizations, or regulatory authorities, we will provide such notification in accordance with the applicable legal requirements.",
        "Where legally permitted and reasonably practicable, we may notify affected Customer Organizations to assist with their own legal and operational responsibilities.",
        "The timing, content, and recipients of notifications will depend on the nature of the incident and applicable law.",
      ],
    },
    {
      title: "Third-Party Websites and Services",
      body: [
        "The Application may contain links to external websites or services.",
        "Those services operate independently and may maintain their own privacy policies, terms, and data-handling practices.",
        "We are not responsible for the privacy or security practices of third-party websites and services that are not operated or controlled by us.",
      ],
    },
    {
      title: "Changes to This Privacy Policy",
      body: [
        "We may update this Privacy Policy to reflect changes in our practices, the Application, or applicable law.",
        "The current version will be published within the Application with its effective or last-updated date.",
        "Where changes materially affect how information is collected, processed, or disclosed, we will provide notice or obtain consent where required by applicable law.",
        "We encourage Users and Customer Organizations to review this Policy periodically.",
      ],
    },
    {
      title: "Contact and Privacy Inquiries",
      body: [
        `${APP} is operated by ${ORG}.`,
        [
          `Privacy inquiries and data requests: ${LEGAL_CONTACT}`,
          `Technical support: ${SUPPORT_CONTACT}`,
        ],
        "For privacy requests, please include your organization name, relevant account information, and a description of your request.",
        "We may request additional information to verify your identity or authority before acting on a request.",
      ],
    },
  ],
};
