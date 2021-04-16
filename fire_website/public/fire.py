import matplotlib.pyplot as plt
import numpy as np

WIDTH = 100
HEIGHT = 50


def calc_advection(field, delta_t):
    field -= delta_t * field
    return position_field

def calc_divergence(velocity_field, i, j):
    return 0.5 * ((velocity_field[j, i+1] - velocity_field[j, i-1]) + (velocity_field[j+1, i] - velocity_field[j-1,i]))

def calc_jacobi(pressure_field, divergence_field, i, j, alpha, beta):
    divergence = divergence_field[j, i]
    return 0.25 * (pressure_field[j, i + 1] + pressure_field[j, i - 1] + pressure_field[j + 1, i] + pressure_field[j - 1, i] - divergence)

def calc_pressure_gradient(pressure_field, velocity_field, i, j):
    pressure_gradient = 0.5 * np.array([pressure_field[j, i+1] - pressure_field[j, i-1], pressure_field[j+1, i] - pressure_field[j-1,i]])
    return velocity_field[j, i] - pressure_gradient

def calc_image(pressure_field, velocity_field, divergence_field, show="velocity"):
    if show == "velocity":
        return np.abs(velocity_field) * 0.008
    elif show == "pressure":
        return np.abs(pressure_field) * 0.05
    elif show == "divergence":
        return np.abs(divergence_field)
    

def main():
    velocity_field = np.zeros((HEIGHT, WIDTH, 2))
    pressure_field = np.zeros((HEIGHT, WIDTH))

    pass