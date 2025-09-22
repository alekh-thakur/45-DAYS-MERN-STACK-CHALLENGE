import { useState } from "react";

function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  //Validation
  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }
    if (!formData.message.trim()) {
      newErrors.message = "Message is required";
    }
    return newErrors;
  };

  //Handle input changes 
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handle submit
  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length === 0) {
      setIsSubmitted(true);
      setErrors({});
      console.log("Form submitted:", formData); 
    } else {
      setErrors(validationErrors);
    }
  };

  return (
    <div>
    <h2>Form validation using React</h2>
      {isSubmitted ? (
        <p style={{ color: "green" }}> Thank you! Your message has been sent.</p>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div>
            <label>Name:</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
            />
            {errors.name && <p style={{ color: "red" }}>{errors.name}</p>}
          </div>

          <div>
            <label>Email:</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
            />
            {errors.email && <p style={{ color: "red" }}>{errors.email}</p>}
          </div>

          <div>
            <label>Message:</label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
            />
            {errors.message && <p style={{ color: "red" }}>{errors.message}</p>}
          </div>

          <button type="submit">Send</button>
        </form>
      )}
    </div>
  );
}

export default ContactForm;
