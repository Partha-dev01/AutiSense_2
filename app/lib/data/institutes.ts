export interface Institute {
  name: string;
  category: "hospital" | "therapy_center" | "special_school" | "support_group";
  lat: number;
  lng: number;
  address: string;
  city: string;
  phone?: string;
  website?: string;
}

export const INSTITUTES: Institute[] = [
  // ── Delhi ──────────────────────────────────────────────────────────
  { name: "Delhi Autism Center of Excellence", category: "hospital", lat: 28.63, lng: 77.22, address: "Sector 5, R.K. Puram", city: "Delhi", phone: "+91-11-2610-4321", website: "https://delhiautismcenter.in" },
  { name: "Nayi Disha Child Development Clinic", category: "therapy_center", lat: 28.59, lng: 77.25, address: "C-12, Saket District Centre", city: "Delhi", phone: "+91-11-4156-7890" },
  { name: "Umang Special School", category: "special_school", lat: 28.64, lng: 77.19, address: "Patel Nagar West, Block 3", city: "Delhi", phone: "+91-11-2587-0044", website: "https://umangschool.org" },
  { name: "Sahyog Autism Parent Network", category: "support_group", lat: 28.57, lng: 77.26, address: "Greater Kailash II, M-Block", city: "Delhi" },
  { name: "Rainbow Neuro Developmental Centre", category: "hospital", lat: 28.66, lng: 77.21, address: "Karol Bagh, Pusa Road", city: "Delhi", phone: "+91-11-2574-3210" },

  // ── Mumbai ─────────────────────────────────────────────────────────
  { name: "Mumbai Institute for Autism Research", category: "hospital", lat: 19.08, lng: 72.88, address: "Andheri East, MIDC", city: "Mumbai", phone: "+91-22-2836-5500", website: "https://mumbaiautism.org" },
  { name: "Niramay Therapy Centre", category: "therapy_center", lat: 19.06, lng: 72.84, address: "Bandra West, Hill Road", city: "Mumbai", phone: "+91-22-2641-7765" },
  { name: "Asha Special Needs School", category: "special_school", lat: 19.10, lng: 72.90, address: "Powai, Hiranandani Gardens", city: "Mumbai", phone: "+91-22-2570-3321", website: "https://ashaspecialschool.in" },
  { name: "Together We Can – Autism Families", category: "support_group", lat: 19.04, lng: 72.85, address: "Dadar West, Shivaji Park", city: "Mumbai", phone: "+91-22-2438-1190" },
  { name: "KEM Developmental Pediatrics Unit", category: "hospital", lat: 19.00, lng: 72.84, address: "Parel, KEM Campus", city: "Mumbai", phone: "+91-22-2410-7000" },

  // ── Bangalore ──────────────────────────────────────────────────────
  { name: "Spandana Autism Rehabilitation Hospital", category: "hospital", lat: 12.98, lng: 77.60, address: "Indiranagar, 100 Feet Road", city: "Bangalore", phone: "+91-80-2527-6543", website: "https://spandanaautism.org" },
  { name: "Nirmala Therapy & Behavioral Centre", category: "therapy_center", lat: 12.95, lng: 77.57, address: "Jayanagar 4th Block", city: "Bangalore", phone: "+91-80-2663-9870" },
  { name: "Vidya Sagar Academy", category: "special_school", lat: 13.00, lng: 77.62, address: "Whitefield, ITPL Main Road", city: "Bangalore", phone: "+91-80-2845-2210", website: "https://vidyasagaracademy.in" },
  { name: "Bangalore Autism Support Circle", category: "support_group", lat: 12.94, lng: 77.58, address: "Koramangala 5th Block", city: "Bangalore" },
  { name: "Sankalp Child Neuro Centre", category: "therapy_center", lat: 12.99, lng: 77.55, address: "Rajajinagar, 1st Block", city: "Bangalore", phone: "+91-80-2330-4455" },

  // ── Chennai ────────────────────────────────────────────────────────
  { name: "Aravind Autism Care Hospital", category: "hospital", lat: 13.06, lng: 80.25, address: "T. Nagar, Usman Road", city: "Chennai", phone: "+91-44-2434-8800", website: "https://aravindautism.in" },
  { name: "Sneha Behavioral Therapy Centre", category: "therapy_center", lat: 13.10, lng: 80.28, address: "Anna Nagar West, 2nd Avenue", city: "Chennai", phone: "+91-44-2621-5533" },
  { name: "Kalvi Special School", category: "special_school", lat: 13.04, lng: 80.24, address: "Adyar, Gandhi Nagar", city: "Chennai", phone: "+91-44-2441-2267" },
  { name: "Chennai Autism Parents Forum", category: "support_group", lat: 13.09, lng: 80.27, address: "Nungambakkam, Sterling Road", city: "Chennai", website: "https://chennaiasd.org" },

  // ── Kolkata ────────────────────────────────────────────────────────
  { name: "Kolkata Institute of Neurodevelopment", category: "hospital", lat: 22.58, lng: 88.37, address: "Salt Lake, Sector V", city: "Kolkata", phone: "+91-33-4005-6700", website: "https://kindkolkata.org" },
  { name: "Prantik Therapy Hub", category: "therapy_center", lat: 22.55, lng: 88.35, address: "Park Street, Russel Street Corner", city: "Kolkata", phone: "+91-33-2229-8866" },
  { name: "Udaan Special Education Centre", category: "special_school", lat: 22.60, lng: 88.39, address: "New Town, Action Area II", city: "Kolkata", phone: "+91-33-2357-4410" },
  { name: "Kolkata Autism Family Alliance", category: "support_group", lat: 22.53, lng: 88.34, address: "Ballygunge, Gariahat Road", city: "Kolkata" },

  // ── Hyderabad ──────────────────────────────────────────────────────
  { name: "NIMHANS Hyderabad Autism Unit", category: "hospital", lat: 17.40, lng: 78.48, address: "Banjara Hills, Road No. 12", city: "Hyderabad", phone: "+91-40-2335-8900", website: "https://nimhans-hyd.in" },
  { name: "Dhruva ABA Therapy Centre", category: "therapy_center", lat: 17.37, lng: 78.45, address: "Jubilee Hills, Kavuri Hills", city: "Hyderabad", phone: "+91-40-2354-1120" },
  { name: "Prajna Inclusive School", category: "special_school", lat: 17.42, lng: 78.50, address: "Secunderabad, Trimulgherry", city: "Hyderabad", phone: "+91-40-2780-6654", website: "https://prajnaschool.org" },
  { name: "Hyderabad Spectrum Support Group", category: "support_group", lat: 17.36, lng: 78.47, address: "Madhapur, Hitech City Road", city: "Hyderabad", phone: "+91-40-2311-4455" },
  { name: "Apollo Autism & ADHD Clinic", category: "hospital", lat: 17.39, lng: 78.49, address: "Begumpet, Greenlands Road", city: "Hyderabad", phone: "+91-40-2340-5600" },

  // ── Pune ───────────────────────────────────────────────────────────
  { name: "Jeevan Jyoti Developmental Hospital", category: "hospital", lat: 18.53, lng: 73.86, address: "Kothrud, Paud Road", city: "Pune", phone: "+91-20-2546-1234", website: "https://jeevanjyotihospital.in" },
  { name: "Ankur Sensory Integration Clinic", category: "therapy_center", lat: 18.50, lng: 73.83, address: "Koregaon Park, Lane 6", city: "Pune", phone: "+91-20-2613-7789" },
  { name: "Pragati Special Needs School", category: "special_school", lat: 18.55, lng: 73.88, address: "Aundh, ITI Road", city: "Pune", phone: "+91-20-2588-0099" },
  { name: "Pune Autism Parents Collective", category: "support_group", lat: 18.48, lng: 73.84, address: "Deccan Gymkhana, FC Road", city: "Pune" },

  // ── Ahmedabad ──────────────────────────────────────────────────────
  { name: "Gujarat Autism Hospital & Research", category: "hospital", lat: 23.04, lng: 72.58, address: "Navrangpura, CG Road", city: "Ahmedabad", phone: "+91-79-2656-3300", website: "https://gahr.org.in" },
  { name: "Sparsh Early Intervention Centre", category: "therapy_center", lat: 23.01, lng: 72.55, address: "Satellite, Jodhpur Cross Road", city: "Ahmedabad", phone: "+91-79-2692-4450" },
  { name: "Prerna Inclusive Academy", category: "special_school", lat: 23.05, lng: 72.60, address: "Bodakdev, S.G. Highway", city: "Ahmedabad", phone: "+91-79-2685-7710" },
  { name: "Ahmedabad ASD Families Network", category: "support_group", lat: 22.99, lng: 72.56, address: "Vastrapur, Near Vastrapur Lake", city: "Ahmedabad" },

  // ── Jaipur ─────────────────────────────────────────────────────────
  { name: "Rajasthan Autism Diagnostic Centre", category: "hospital", lat: 26.92, lng: 75.79, address: "C-Scheme, Ashok Marg", city: "Jaipur", phone: "+91-141-2362-900", website: "https://radc-jaipur.in" },
  { name: "Tarang Occupational Therapy Clinic", category: "therapy_center", lat: 26.89, lng: 75.77, address: "Malviya Nagar, D-Block", city: "Jaipur", phone: "+91-141-2752-678" },
  { name: "Jyoti Bal Vikas School", category: "special_school", lat: 26.94, lng: 75.80, address: "Vaishali Nagar, A-Block", city: "Jaipur", phone: "+91-141-2356-1190" },
  { name: "Jaipur Spectrum Parents Group", category: "support_group", lat: 26.88, lng: 75.76, address: "Mansarovar, Shipra Path", city: "Jaipur" },

  // ── Lucknow ────────────────────────────────────────────────────────
  { name: "KGMU Child Neurology Wing", category: "hospital", lat: 26.86, lng: 80.94, address: "Chowk, KGMU Campus", city: "Lucknow", phone: "+91-522-2257-001", website: "https://kgmu.org" },
  { name: "Ujjwal Behavioral Therapy Centre", category: "therapy_center", lat: 26.88, lng: 80.97, address: "Gomti Nagar, Vipin Khand", city: "Lucknow", phone: "+91-522-2302-445" },
  { name: "Samarth Special Education School", category: "special_school", lat: 26.83, lng: 80.93, address: "Aliganj, Sector C", city: "Lucknow", phone: "+91-522-2326-780" },
  { name: "Lucknow Autism Awareness Group", category: "support_group", lat: 26.87, lng: 80.96, address: "Hazratganj, MG Road", city: "Lucknow" },

  // ── Kochi ──────────────────────────────────────────────────────────
  { name: "Amrita Autism Centre", category: "hospital", lat: 9.94, lng: 76.27, address: "Edappally, NH Bypass", city: "Kochi", phone: "+91-484-2801-234", website: "https://amritaautism.org" },
  { name: "Kerala Spectrum Therapy Hub", category: "therapy_center", lat: 9.92, lng: 76.25, address: "Kakkanad, Infopark Road", city: "Kochi", phone: "+91-484-2422-556" },
  { name: "Jyothis Special School", category: "special_school", lat: 9.96, lng: 76.28, address: "Aluva, Periyar Nagar", city: "Kochi", phone: "+91-484-2624-890" },
  { name: "Kochi ASD Family Support Circle", category: "support_group", lat: 9.91, lng: 76.24, address: "Ernakulam, MG Road", city: "Kochi" },

  // ── Chandigarh ─────────────────────────────────────────────────────
  { name: "PGI Autism Diagnostic Clinic", category: "hospital", lat: 30.76, lng: 76.78, address: "Sector 12, PGI Campus", city: "Chandigarh", phone: "+91-172-2746-001", website: "https://pgimer.edu.in" },
  { name: "Chetna Speech & Development Centre", category: "therapy_center", lat: 30.72, lng: 76.76, address: "Sector 35-C, Market", city: "Chandigarh", phone: "+91-172-2660-443" },
  { name: "Nai Udaan Inclusive School", category: "special_school", lat: 30.74, lng: 76.80, address: "Sector 22, Inner Market", city: "Chandigarh", phone: "+91-172-2710-558" },
  { name: "Tricity Autism Support Network", category: "support_group", lat: 30.70, lng: 76.75, address: "Sector 44-D, Community Hall", city: "Chandigarh" },
];

export const CATEGORY_LABELS: Record<Institute["category"], string> = {
  hospital: "Hospital",
  therapy_center: "Therapy Center",
  special_school: "Special School",
  support_group: "Support Group",
};

export const CATEGORY_COLORS: Record<Institute["category"], string> = {
  hospital: "#e74c3c",
  therapy_center: "#3498db",
  special_school: "#27ae60",
  support_group: "#9b59b6",
};
