// Static interface-review data only. Never used by login, the API, or transcript conversion.
export const previewUsers = [
  { id: 'ADMIN', name: 'Admin', role: 'ADMIN', specialization: 'Administrator' },
  { id: 'PM01', name: 'Ayesha Khan', role: 'MANAGER', specialization: 'Web PM' },
  { id: 'PM02', name: 'Bilal Ahmed', role: 'MANAGER', specialization: 'Mobile PM' },
  { id: 'PM03', name: 'Hina Malik', role: 'MANAGER', specialization: 'AI PM' },
  { id: 'DEV01', name: 'Ali Raza', role: 'AGENT', specialization: 'Full-Stack' },
  { id: 'DEV02', name: 'Hamza Shah', role: 'AGENT', specialization: 'Full-Stack' },
  { id: 'DEV03', name: 'Sara Noor', role: 'AGENT', specialization: 'App Developer' },
  { id: 'DEV04', name: 'Usman Tariq', role: 'AGENT', specialization: 'App Developer' },
  { id: 'DEV05', name: 'Zain Abbas', role: 'AGENT', specialization: 'AI Developer' },
  { id: 'DEV06', name: 'Maryam Asif', role: 'AGENT', specialization: 'AI Developer' },
];
export const previewProjects = [
  { id: 'sample-web', name: 'UrbanCart Website', clientName: 'UrbanCart Clothing', managerId: 'PM01', managerName: 'Ayesha Khan', deadline: '2026-10-20', description: 'A responsive product browsing experience with a demo cart. Real payments and inventory integration are outside this phase.' },
  { id: 'sample-mobile', name: 'QuickServe Mobile App', clientName: 'QuickServe Services', managerId: 'PM02', managerName: 'Bilal Ahmed', deadline: '2026-10-24', description: 'A Flutter customer demo for login, service booking and booking status. Maps, driver tracking and payments are excluded.' },
  { id: 'sample-ai', name: 'HelpDeskPro AI Assistant', clientName: 'HelpDeskPro Solutions', managerId: 'PM03', managerName: 'Hina Malik', deadline: '2026-10-22', description: 'FAQ-grounded support answers with saved human escalation for unresolved questions. No external email or ticketing integration.' },
];
const rows = [
  [0,'Product catalog UI','Product listing, product details and responsive layout.','DEV01','2026-10-12',12],
  [0,'Demo cart UI','Add and remove items, update quantities and display a visible total.','DEV01','2026-10-15',8],
  [0,'Product and cart APIs','Product responses and basic demo cart endpoints.','DEV02','2026-10-14',14],
  [0,'Website integration and testing','Connect the screens and APIs and test the demo buying flow.','DEV01','2026-10-19',6],
  [1,'Login and profile screens','Customer login interface and a basic profile screen.','DEV03','2026-10-12',8],
  [1,'Service booking screens','Service selection, request details and confirmation.','DEV03','2026-10-17',12],
  [1,'Booking and account APIs','Customer account handling, service requests and request status.','DEV02','2026-10-16',16],
  [1,'Mobile integration and testing','Connect UI and APIs, display status, test login through booking.','DEV04','2026-10-22',10],
  [2,'FAQ document processing','Prepare the FAQ and retrieve relevant content.','DEV06','2026-10-13',10],
  [2,'Assistant answer generation','Generate grounded answers; acknowledge unsupported questions.','DEV05','2026-10-17',14],
  [2,'Human escalation flow','Save unresolved questions for human review.','DEV05','2026-10-18',6],
  [2,'Assistant evaluation and testing','Test supported answers, unsupported questions and escalation.','DEV06','2026-10-21',8],
];
export const previewTasks = rows.map(([p,title,description,assigneeId,deadline,estimatedHours],i) => ({ id: `sample-${i}`, projectId: previewProjects[p].id, projectName: previewProjects[p].name, title,description,assigneeId,assigneeName: previewUsers.find(u=>u.id===assigneeId).name,deadline,estimatedHours }));
