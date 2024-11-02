import regionesChile from './regionesChile.js';
// register.js

// Variables y funciones para manejar la selección de género
let gender = '';

function handleGenderSelection(selectedGender) {
  gender = selectedGender;
  document.querySelectorAll('input[name="gender"]').forEach(input => {
    input.checked = input.value === selectedGender;
  });
}

document.getElementById('male').addEventListener('click', () => handleGenderSelection('male'));
document.getElementById('female').addEventListener('click', () => handleGenderSelection('female'));
document.getElementById('other').addEventListener('click', () => handleGenderSelection('other'));

// Manejo de regiones y comunas
document.addEventListener("DOMContentLoaded", () => {
  const regionSelect = document.getElementById("region");
  const comunaSelect = document.getElementById("comuna");

  // Ocultar todas las comunas excepto la opción por defecto al cargar
  for (let i = 0; i < comunaSelect.options.length; i++) {
    const option = comunaSelect.options[i];
    if (option.getAttribute('data-region') !== null) {
      option.style.display = 'none';
    }
  }

  // Al cambiar la región seleccionada
  regionSelect.addEventListener("change", (event) => {
    const selectedRegionIndex = regionSelect.selectedIndex - 1; // Restamos 1 por la opción por defecto
    const options = comunaSelect.options;

    // Mostrar u ocultar comunas según la región seleccionada
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      const regionIndex = option.getAttribute('data-region');

      if (regionIndex === null) continue; // Omitir la opción por defecto

      if (parseInt(regionIndex) === selectedRegionIndex) {
        option.style.display = '';
      } else {
        option.style.display = 'none';
      }
    }

    // Reiniciar el select de comunas
    comunaSelect.selectedIndex = 0;
  });
});

// Función para resetear el formulario
document.getElementById('reset').addEventListener('click', () => {
  document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]').forEach(input => {
    input.value = '';
  });
  document.getElementById('region').selectedIndex = 0;

  const comunaSelect = document.getElementById('comuna');
  comunaSelect.selectedIndex = 0;

  // Ocultar todas las comunas excepto la opción por defecto
  for (let i = 0; i < comunaSelect.options.length; i++) {
    const option = comunaSelect.options[i];
    if (option.getAttribute('data-region') !== null) {
      option.style.display = 'none';
    }
  }

  gender = ''; // Resetear género

  // Desmarcar género
  document.querySelectorAll('input[name="gender"]').forEach(input => {
    input.checked = false;
  });
});


